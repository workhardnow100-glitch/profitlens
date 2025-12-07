// /pages/api/truelayer/pull.js
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { client_id } = req.query;

  const { data: tokenRow } = await supabase
    .from('bank_tokens')
    .select('access_token')
    .eq('client_id', client_id)
    .single();

  if (!tokenRow) return res.status(404).json({ error: 'No token found' });

  const txRes = await axios.get('https://api.truelayer.com/data/v1/transactions', {
    headers: { Authorization: `Bearer ${tokenRow.access_token}` }
  });

  const transactions = txRes.data.results;

  for (const tx of transactions) {
    await supabase.from('transactions').insert({
      client_id,
      amount: tx.amount,
      description: tx.description,
      category: tx.transaction_category,
      timestamp: tx.timestamp,
      account_number: tx.account_number,
      sort_code: tx.sort_code
    });
  }

  res.status(200).json({ status: 'Transactions ingested' });
}
