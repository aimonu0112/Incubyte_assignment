import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InventoryRequest {
  quantity: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin || false;

    const url = new URL(req.url);
    const path = url.pathname;

    const purchaseMatch = path.match(/\/sweets\/([a-f0-9-]+)\/purchase$/);
    if (purchaseMatch) {
      const sweetId = purchaseMatch[1];
      const { quantity }: InventoryRequest = await req.json();

      if (!quantity || quantity <= 0) {
        return new Response(
          JSON.stringify({ error: 'Quantity must be greater than 0' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: sweet, error: fetchError } = await supabase
        .from('sweets')
        .select('quantity')
        .eq('id', sweetId)
        .maybeSingle();

      if (fetchError || !sweet) {
        return new Response(
          JSON.stringify({ error: 'Sweet not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (sweet.quantity < quantity) {
        return new Response(
          JSON.stringify({ error: 'Insufficient quantity in stock' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const newQuantity = sweet.quantity - quantity;

      const { data: updatedSweet, error: updateError } = await supabase
        .from('sweets')
        .update({ quantity: newQuantity })
        .eq('id', sweetId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabase.from('transactions').insert({
        sweet_id: sweetId,
        user_id: user.id,
        transaction_type: 'purchase',
        quantity,
      });

      return new Response(
        JSON.stringify({
          message: 'Purchase successful',
          sweet: updatedSweet,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const restockMatch = path.match(/\/sweets\/([a-f0-9-]+)\/restock$/);
    if (restockMatch) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const sweetId = restockMatch[1];
      const { quantity }: InventoryRequest = await req.json();

      if (!quantity || quantity <= 0) {
        return new Response(
          JSON.stringify({ error: 'Quantity must be greater than 0' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: sweet, error: fetchError } = await supabase
        .from('sweets')
        .select('quantity')
        .eq('id', sweetId)
        .maybeSingle();

      if (fetchError || !sweet) {
        return new Response(
          JSON.stringify({ error: 'Sweet not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const newQuantity = sweet.quantity + quantity;

      const { data: updatedSweet, error: updateError } = await supabase
        .from('sweets')
        .update({ quantity: newQuantity })
        .eq('id', sweetId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabase.from('transactions').insert({
        sweet_id: sweetId,
        user_id: user.id,
        transaction_type: 'restock',
        quantity,
      });

      return new Response(
        JSON.stringify({
          message: 'Restock successful',
          sweet: updatedSweet,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
