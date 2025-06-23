
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate yesterday's date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    console.log(`Processing recurring jobs for date: ${yesterdayStr}`)

    // Find recurring jobs that were scheduled yesterday and are paid/completed
    const { data: recurringJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_recurring', true)
      .in('status', ['paid', 'completed'])
      .gte('scheduled_date', yesterdayStr)
      .lt('scheduled_date', `${yesterdayStr}T23:59:59`)

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${recurringJobs?.length || 0} recurring jobs to process`)

    if (!recurringJobs || recurringJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recurring jobs to process' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Duplicate each recurring job with appropriate frequency
    const newJobs = recurringJobs.map(job => {
      const nextScheduledDate = new Date(job.scheduled_date)
      
      // Calculate next date based on frequency
      switch (job.frequency) {
        case 'weekly':
          nextScheduledDate.setDate(nextScheduledDate.getDate() + 7)
          break
        case 'bi-weekly':
          nextScheduledDate.setDate(nextScheduledDate.getDate() + 14)
          break
        case 'monthly':
          nextScheduledDate.setMonth(nextScheduledDate.getMonth() + 1)
          break
        default:
          // Default to weekly if frequency is not set
          nextScheduledDate.setDate(nextScheduledDate.getDate() + 7)
      }

      return {
        title: job.title,
        price: job.price,
        description: job.description,
        scheduled_date: nextScheduledDate.toISOString(),
        is_recurring: true,
        frequency: job.frequency || 'weekly',
        status: 'pending',
        client_id: job.client_id,
        stripe_checkout_url: null, // Reset checkout URL for new job
      }
    })

    // Insert the new jobs
    const { data: insertedJobs, error: insertError } = await supabase
      .from('jobs')
      .insert(newJobs)
      .select()

    if (insertError) {
      throw insertError
    }

    console.log(`Successfully created ${insertedJobs?.length || 0} new recurring jobs`)

    return new Response(
      JSON.stringify({ 
        message: `Processed ${recurringJobs.length} recurring jobs, created ${insertedJobs?.length || 0} new jobs`,
        processedJobs: recurringJobs.length,
        createdJobs: insertedJobs?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing recurring jobs:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
