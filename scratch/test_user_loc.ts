import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Import api to see what getOrganizationStructure returns
import { api } from '../services/api';

async function test() {
    const orgStructureData = await api.getOrganizationStructure().catch(() => []);
    console.log('orgStructureData:', JSON.stringify(orgStructureData, null, 2));

    const usersData = await api.getUsers();
    console.log('users count:', usersData.length);

    const resolveUserLocation = (u: any, orgStructure: any[]) => {
      if (u.location || u.locationName) return u.location || u.locationName;
      if (!u.societyId || orgStructure.length === 0) return '';

      for (const group of orgStructure) {
        if (group.companies) {
          for (const company of group.companies) {
            if (company.id === u.societyId) {
              return company.location || '';
            }
          }
        }
      }
      return '';
    };

    const targetUsers = usersData.filter(u => {
      const loc = resolveUserLocation(u, orgStructureData || []);
      return loc && loc.toLowerCase() === 'bangalore';
    });

    console.log('targetUsers with Bangalore count:', targetUsers.length);
    console.log('First 5 targetUsers:', targetUsers.slice(0, 5).map(u => ({ id: u.id, name: u.name, location: resolveUserLocation(u, orgStructureData) })));
    console.log('Is Arpitha in targetUsers?', targetUsers.some(u => u.name.includes('Arpitha')));
}

test().catch(console.error);
