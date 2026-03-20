/**
 * Utility Script: Backfill Attendance Event Location Names
 * 
 * This script fetches all attendance events with coordinates but no location name,
 * resolves their addresses using the geocoding API, and updates the database.
 * 
 * Run this once after migrating the database schema to populate historical events.
 */

import { api } from '../services/api';
import { supabase } from '../services/supabase';

async function backfillAttendanceAddresses() {
    console.log('🔄 Starting backfill of attendance event addresses...');

    try {
        // Fetch all events that need backfilling
        const { data: events, error } = await supabase
            .from('attendance_events')
            .select('id, latitude, longitude, location_id')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .is('location_name', null);

        if (error) {
            console.error('❌ Error fetching events:', error);
            return;
        }

        if (!events || events.length === 0) {
            console.log('✅ No events need backfilling!');
            return;
        }

        console.log(`📊 Found ${events.length} events to backfill`);

        // Step 1: Try to populate from existing geofence locations
        const { data: locations } = await supabase
            .from('locations')
            .select('id, name, address');

        if (locations) {
            const locationMap = new Map(locations.map((loc: { id: string; name: string | null; address: string | null }) => 
                [loc.id, loc.name || loc.address]
            ));
            
            for (const event of events) {
                if (event.location_id && locationMap.has(event.location_id)) {
                    await supabase
                        .from('attendance_events')
                        .update({ location_name: locationMap.get(event.location_id) })
                        .eq('id', event.id);
                    
                    console.log(`✓ Updated event ${event.id} from geofence location`);
                }
            }
        }

        // Step 2: Fetch remaining events that still need addresses
        const { data: remainingEvents, error: remainingError } = await supabase
            .from('attendance_events')
            .select('id, latitude, longitude')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .is('location_name', null);

        if (remainingError || !remainingEvents || remainingEvents.length === 0) {
            console.log('✅ All events have been backfilled!');
            return;
        }

        console.log(`🌍 Geocoding ${remainingEvents.length} remaining events...`);

        // Batch geocode in chunks to respect rate limits
        const BATCH_SIZE = 50;
        for (let i = 0; i < remainingEvents.length; i += BATCH_SIZE) {
            const batch = remainingEvents.slice(i, i + BATCH_SIZE);
            const coords = batch.map((e: { latitude: number; longitude: number }) => 
                ({ lat: e.latitude, lon: e.longitude })
            );

            try {
                const addresses = await api.batchResolveAddresses(coords);
                
                // Update each event with its resolved address
                for (const event of batch) {
                    const key = `${event.latitude.toFixed(6)},${event.longitude.toFixed(6)}`;
                    const address = addresses[key];
                    
                    if (address) {
                        await supabase
                            .from('attendance_events')
                            .update({ location_name: address })
                            .eq('id', event.id);
                        
                        console.log(`✓ Geocoded and updated event ${event.id}`);
                    }
                }
                
                // Rate limiting: wait 1 second between batches
                if (i + BATCH_SIZE < remainingEvents.length) {
                    console.log(`⏳ Waiting 1 second before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`❌ Error geocoding batch ${i / BATCH_SIZE + 1}:`, error);
            }
        }

        console.log('✅ Backfill complete!');
    } catch (error) {
        console.error('❌ Backfill failed:', error);
    }
}

// Run the backfill
backfillAttendanceAddresses();
