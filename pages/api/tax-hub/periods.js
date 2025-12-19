// pages/api/tax-hub/periods.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function fmt(d){return d.toISOString().split("T")[0];}
function label(start,end){return `${new Date(start).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} → ${new Date(end).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}`;}
function generateVatPeriods(stagger,yearsBack=5){const now=new Date();const periods=[];const staggerMonths={1:[0,3,6,9],2:[1,4,7,10],3:[2,5,8,11]}[stagger];for(let y=now.getFullYear()-yearsBack;y<=now.getFullYear();y++){for(const m of staggerMonths){const start=new Date(y,m,16);const end=new Date(y,m+3,15);if(end<=now){periods.push({periodStart:fmt(start),periodEnd:fmt(end),periodLabel:label(fmt(start),fmt(end))});}}}return periods.reverse();}

export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const session=await getServerSession(req,res,authOptions);
 if(!session?.user)return res.status(401).json({error:"Unauthorized"});
 const isFounder=session.user.role==="admin";
 const isSubscribedOrTrial=["basic","pro","trialing"].includes(session.user.subscriptionStatus);
 if(!(isFounder||isSubscribedOrTrial))return res.status(403).json({error:"Upgrade required"});
 const actingClientId=session.user.actingAsClientId||session.user.clientId;
 const {clientId}=req.body;
 if(!clientId)return res.status(400).json({error:"Missing clientId"});
 if(session.user.role==="accountant"&&clientId!==actingClientId)return res.status(403).json({error:"Accountants cannot request tax periods for unauthorized clients"});
 try{
  if(session.user.role==="accountant"){await supabaseAdmin.from("audit").insert([{client_id:clientId,actor_email:session.user.email,action:"ACCOUNTANT_VIEW_TAX_HUB_PERIODS",details:"Viewed VAT/CIS/CT/SA periods in Tax Hub"}]);}
  const {data:transactions,error:txError}=await supabaseAdmin.from("transactions").select("id,date,business_category,tax_locked,client_id,vat_amount,amount,cis_amount,cis_type").eq("client_id",clientId);
  if(txError)throw txError;
  const grouped={vat:[],cis:[],corp:[],sa:[]};
  transactions.forEach(tx=>{const c=(tx.business_category||"").toLowerCase();if(c==="vat")grouped.vat.push(tx);else if(c==="cis")grouped.cis.push(tx);else if(c==="corporation tax")grouped.corp.push(tx);else if(c==="self assessment")grouped.sa.push(tx);});
  function buildCISPeriods(cisTxs){const periods={};cisTxs.forEach(tx=>{const d=new Date(tx.date);let ps=new Date(d.getFullYear(),d.getMonth(),6);if(d.getDate()<6)ps=new Date(d.getFullYear(),d.getMonth()-1,6);const pe=new Date(ps.getFullYear(),ps.getMonth()+1,5);const key=`${ps.toISOString().slice(0,10)}_${pe.toISOString().slice(0,10)}`;if(!periods[key]){periods[key]={periodLabel:`${ps.toISOString().slice(0,10)} → ${pe.toISOString().slice(0,10)}`,periodStart:ps.toISOString().slice(0,10),periodEnd:pe.toISOString().slice(0,10),locked:false,hmrcAuthorized:true,transactions:[]};}periods[key].transactions.push(tx);if(tx.tax_locked)periods[key].locked=true;});return Object.values(periods);}
  let cisPeriods=buildCISPeriods(grouped.cis).map(p=>{let d=0,s=0;p.transactions.forEach(tx=>{const amt=Number(tx.cis_amount||0);if(tx.cis_type==="deducted")d+=amt;else if(tx.cis_type==="suffered")s+=amt;});return {...p,cisDeducted:d,cisSuffered:s,netCis:d-s};});
  function buildCorpPeriods(corpTxs){const periods={};corpTxs.forEach(tx=>{const d=new Date(tx.date);const y=d.getFullYear();const ps=new Date(y,0,1);const pe=new Date(y,11,31);const key=`${y}`;if(!periods[key]){periods[key]={periodLabel:`${ps.toISOString().slice(0,10)} → ${pe.toISOString().slice(0,10)}`,periodStart:ps.toISOString().slice(0,10),periodEnd:pe.toISOString().slice(0,10),locked:false,hmrcAuthorized:true,transactions:[]};}periods[key].transactions.push(tx);if(tx.tax_locked)periods[key].locked=true;});return Object.values(periods);}
  const corpPeriods=buildCorpPeriods(grouped.corp);
  const {data:vatPayments}=await supabaseAdmin.from("vat_payments").select("*").eq("client_id",clientId).order("payment_date",{ascending:false});
  const {data:vatSetting}=await supabaseAdmin.from("vat_settings").select("stagger").eq("client_id",clientId).maybeSingle();
  let stagger=vatSetting?.stagger||1;
  const rawVatPeriods=generateVatPeriods(stagger);
  let totalVatOwed=0,totalVatOutput=0,totalVatInput=0;const vatPeriods=[];const now=new Date();
  for(const p of rawVatPeriods){
   const summaryRes=await fetch("/api/vat/summary",{method:"POST",headers:{"Content-Type":"application/json","x-internal-secret":process.env.INTERNAL_SECRET},body:JSON.stringify({clientId,periodStart:p.periodStart,periodEnd:p.periodEnd})});
   let box1=0,box4=0,box5=0,locked=false,submitted=false;
   if(summaryRes.ok){const s=await summaryRes.json();box1=s.boxes?.box1||0;box4=s.boxes?.box4||0;box5=s.boxes?.box5||0;locked=s.locked||false;submitted=s.submitted||false;}
   totalVatOwed+=box5;totalVatOutput+=box1;totalVatInput+=box4;
   const endDate=new Date(p.periodEnd);const hasActivity=Math.abs(box1)>0||Math.abs(box4)>0||Math.abs(box5)!==0;
   let status="Draft";if(submitted)status="Submitted";else if(endDate<now&&hasActivity)status="Overdue";else if(hasActivity)status="Ready to Submit";else if(endDate<now&&!hasActivity)status="Draft (No Activity)";
   const overdue=!submitted&&endDate<now&&hasActivity;
   vatPeriods.push({periodLabel:p.periodLabel,periodStart:p.periodStart,periodEnd:p.periodEnd,locked,hmrcAuthorized:true,submitted,outputVat:box1,inputVat:box4,netVat:box5,status,overdue});
  }
  const totalVatPaid=(vatPayments||[]).reduce((sum,p)=>sum+(p.direction==="payment"?p.amount:-p.amount),0);
  const vatBalance=totalVatOwed-totalVatPaid;
  const {data:ctPayments}=await supabaseAdmin.from("ct_payments").select("*").eq("client_id",clientId).order("payment_date",{ascending:false});
  const totalCorpTaxDue=corpPeriods.reduce((sum,p)=>sum+(p.corpTaxDue||0),0);
  const totalCtPaid=(ctPayments||[]).reduce((sum,p)=>sum+(p.direction==="payment"?p.amount:-p.amount),0);
  const ctBalance=totalCorpTaxDue-totalCtPaid;
  const overdueVatCount=vatPeriods.filter(p=>p.overdue).length;
  return res.status(200).json({vat:vatPeriods,cis:cisPeriods,corp:corpPeriods,sa:grouped.sa.map(tx=>({periodLabel:tx.date,periodStart:tx.date,periodEnd:tx.date,locked:tx.tax_locked,hmrcAuthorized:(tx.business_category||"").toLowerCase()==="self assessment"})),vatStagger:stagger,vatPayments,totalVatOwed,totalVatPaid,vatBalance,totalVatOutput,totalVatInput,overdueVatCount,ctPayments,totalCorpTaxDue,totalCtPaid,ctBalance});
 }catch(err){console.error("Tax Hub periods error:",err);return res.status(500).json({error:err.message});}
}
