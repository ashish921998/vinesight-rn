import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationPayload {
  user_id: string;
  task_id: number;
  task_title: string;
  assigner_name?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    const { user_id, task_id, task_title, assigner_name }: NotificationPayload = await req.json();

    if (!user_id || !task_id || !task_title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, task_id, task_title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push tokens for the user
    const { data: pushTokens, error: tokenError } = await supabase
      .from('device_push_tokens')
      .select('expo_push_token, device_name, platform')
      .eq('user_id', user_id);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pushTokens || pushTokens.length === 0) {
      // No push tokens found, user hasn't registered for push notifications
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user', tokensFound: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the notification message
    const notificationTitle = 'New Task Assigned';
    const notificationBody = assigner_name
      ? `${assigner_name} assigned you a task: ${task_title}`
      : `You have been assigned a new task: ${task_title}`;

    // Send push notifications via Expo
    const expoMessages = pushTokens.map((token) => ({
      to: token.expo_push_token,
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: 'task_assigned',
        taskId: task_id,
        taskTitle: task_title,
      },
      sound: 'default',
      priority: 'high' as const,
    }));

    // Note: In production, you'd use Expo's Push API
    // For now, we'll log what would be sent
    // In a real implementation, you'd make API calls to Expo:
    // const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(expoMessages),
    // });

    console.log('Would send push notifications:', JSON.stringify(expoMessages, null, 2));

    // For now, return success - in production, handle the Expo API response
    return new Response(
      JSON.stringify({
        success: true,
        tokensFound: pushTokens.length,
        message: 'Notifications queued',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-task-notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
