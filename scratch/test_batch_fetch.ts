import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { api } from '../services/api';
import { format, subDays, startOfWeek } from 'date-fns';

async function test() {
    const orgStructureData = await api.getOrganizationStructure().catch(() => []);
    const usersData = await api.getUsers();

    const resolveUserLocation = (u: any, orgStructure: any[]) => {
      if (u.location || u.locationName) return u.location || u.locationName;
      if (!u.societyId || orgStructure.length === 0) return '';
      for (const group of orgStructure) {
        if (group.companies) {
          for (const company of group.companies) {
            if (company.id === u.societyId) return company.location || '';
          }
        }
      }
      return '';
    };

    const targetUsers = usersData.filter(u => {
      const loc = resolveUserLocation(u, orgStructureData || []);
      return loc && loc.toLowerCase() === 'bangalore';
    });

    const targetUserIds = targetUsers.map(u => u.id);
    const startDate = new Date(2026, 7, 1); // August 1, 2026
    const endDate = new Date(2026, 7, 31);
    const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });

    console.log('Fetching events for', targetUserIds.length, 'users...');
    const allEvents = await api.getAttendanceEventsForUsers(
        targetUserIds,
        format(fetchStartDate, 'yyyy-MM-dd'),
        format(new Date(endDate.getTime() + 36 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
    );

    console.log('Total allEvents fetched:', allEvents.length);

    const arpitha = targetUsers.find(u => u.name.includes('Arpitha'));
    const arpithaEvents = allEvents.filter(e => e.userId === arpitha?.id);
    console.log('Arpitha events count from api.getAttendanceEventsForUsers:', arpithaEvents.length);
    console.log('Arpitha events sample:', arpithaEvents.slice(0, 3));
}

test().catch(console.error);
