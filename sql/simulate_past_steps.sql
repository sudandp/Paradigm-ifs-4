-- Migration: Simulate steps and sqft for past attendance events where it's 0 or null (useful for demo/UI purposes)
UPDATE attendance_events
SET 
    -- Generate a random number of steps between 500 and 4000 for office staff 
    -- if they currently have 0 or null steps
    steps = FLOOR(RANDOM() * 3500 + 500),
    -- Set sqft based on the generated steps (steps * 20)
    sqft = FLOOR(RANDOM() * 3500 + 500) * 20
WHERE steps IS NULL OR steps = 0;

-- Then ensure sqft matches the 20x formula exactly for any remaining rows
UPDATE attendance_events
SET sqft = steps * 20
WHERE sqft IS NULL OR sqft != steps * 20;
