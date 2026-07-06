import { supabase } from './lib/supabase';

async function run() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .ilike('name', '%6th Cross Road, Corporation Colony%');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log('Found:', JSON.stringify(data, null, 2));

  // Find duplicates and delete the one created later, or the one assigned to Uma vs Tikna.
  // The screenshot shows one assigned to "Uma" and one to "Tikna Kanai" (assuming those are names).
  // Actually, we'll just delete the second one if they are true duplicates.
  if (data && data.length > 1) {
    // For now, let's just log them so we can decide which one to delete.
    const ids = data.map(d => d.id);
    console.log('Duplicate IDs:', ids);
    
    // We will delete the one created later, for example.
    const sorted = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const toDelete = sorted[1].id; // delete the later one
    
    console.log('Deleting:', toDelete);
    
    const { error: deleteError } = await supabase.from('locations').delete().eq('id', toDelete);
    if (deleteError) {
      console.error('Error deleting:', deleteError);
    } else {
      console.log('Deleted successfully.');
    }
  } else {
    console.log('No duplicates found.');
  }
}

run();
