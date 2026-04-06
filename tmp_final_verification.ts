
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

async function testFinalSave() {
    console.log('Testing final saveEntity logic...');
    
    const entityId = `ent_test_${Date.now()}`;
    const testEntity = {
        id: entityId,
        name: 'Final Test Entity Storage',
        companyId: '776e62ba-da00-4740-9844-30d8f071fdbb', 
        status: 'completed',
        epfoCode: 'FINALEPFO',
        epfoDocUrl: 'https://test.url/final_epfo.pdf',
        esicCode: 'FINALESIC',
        esicDocUrl: 'https://test.url/final_esic.pdf',
        eShramNumber: 'FINALSHRAM',
        eShramDocUrl: 'https://test.url/final_shram.pdf',
        cinNumber: 'FINALCIN',
        cinDocUrl: 'https://test.url/final_cin.pdf'
    };

    const dbData = toSnakeCase(testEntity);
    console.log('Inserting test record with status:', testEntity.status);

    const { data, error } = await supabase.from('entities').insert(dbData).select().single();
    
    if (error) {
        console.error('Error during insert:', error);
    } else {
        console.log('Successfully saved entity! Verification results:');
        console.log('  ID:', data.id);
        console.log('  Status:', data.status);
        console.log('  EPFO Doc:', data.epfo_doc_url);
        console.log('  ESIC Doc:', data.esic_doc_url);
        console.log('  E-Shram Doc:', data.e_shram_doc_url);
        console.log('  CIN Doc:', data.cin_doc_url);
        
        if (data.status === 'completed' && data.epfo_doc_url) {
            console.log('✅ ALL TESTS PASSED');
        } else {
            console.log('❌ SOME FIELDS MISSING');
        }

        // Clean up
        await supabase.from('entities').delete().eq('id', data.id);
        console.log('Test entity cleaned up.');
    }
}

testFinalSave();
