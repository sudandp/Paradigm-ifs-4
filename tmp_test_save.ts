
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

const toSnakeCase = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const snaked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snaked[snakeKey] = toSnakeCase(data[key]);
      }
    }
    return snaked;
  }
  return data;
};

async function testSave() {
    console.log('Testing saveEntity with statutory docs...');
    
    // 1. Create a dummy test entity
    const testEntity = {
        name: 'Test Entity Document Storage',
        companyId: '776e62ba-da00-4740-9844-30d8f071fdbb', // Paradigm Services ID
        epfoCode: 'TESTEPFO123',
        epfoDocUrl: 'https://test.url/epfo.pdf',
        esicCode: 'TESTESIC123',
        esicDocUrl: 'https://test.url/esic.pdf',
        eShramNumber: 'TESTSHRAM123',
        eShramDocUrl: 'https://test.url/shram.pdf',
        cinNumber: 'TESTCIN123',
        cinDocUrl: 'https://test.url/cin.pdf'
    };

    const dbData = toSnakeCase(testEntity);
    console.log('Data to insert (snaked):', JSON.stringify(dbData, null, 2));

    const { data, error } = await supabase.from('entities').insert(dbData).select().single();
    
    if (error) {
        console.error('Error during insert:', error);
    } else {
        console.log('Successfully inserted entity:', data.name);
        console.log('Returned columns for docs:');
        console.log('  epfo_doc_url:', data.epfo_doc_url);
        console.log('  esic_doc_url:', data.esic_doc_url);
        console.log('  e_shram_doc_url:', data.e_shram_doc_url);
        console.log('  cin_doc_url:', data.cin_doc_url);
        
        // Now clean up
        await supabase.from('entities').delete().eq('id', data.id);
        console.log('Cleaned up test entity.');
    }
}

testSave();
