-- ============================================================================
-- SQL Query: Insert Bengaluru Society & Gate Locations into public.locations
-- Page Target: /#/hr/locations (Existing Locations Tab)
-- Total Locations: 74
-- ============================================================================

-- Ensure column 'kiosk_pin' exists on public.locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kiosk_pin TEXT DEFAULT '1234';

INSERT INTO public.locations (name, address, latitude, longitude, radius, kiosk_pin)
SELECT v.name, v.address, v.latitude, v.longitude, v.radius, v.kiosk_pin
FROM (VALUES
    ('GREENWOOD REGENCY APARTMENT OWNERS ASSOCIATION', '62/1, GREENWOOD REGENCY, SARJAPUR MAIN ROAD, DODDAKANAHALLI, Bengaluru Urban, Karnataka,560035', 12.9140796487855, 77.6833704460878, 100, '1234'),
    ('Sobha Morzaria Grandeur Apartment Owners Association', '#4, Bannerghatta Main road, Between Oracle & Accenture Building, Near Dairy circle, Bangalore 560029', 12.9340146245228, 77.6016443789371, 100, '1234'),
    ('Sobha Chrysanthemum Apartment Owner''s Welfare Association - Gate 1', 'Thanisandra Main Road, Near Hegde Nagar,Dr.Shivarama Karanth Nagar Post, Bangalore-560077', 13.061016, 77.635798, 100, '1234'),
    ('Sobha Chrysanthemum Apartment Owner''s Welfare Association - Gate 2', 'Thanisandra Main Road, Near Hegde Nagar,Dr.Shivarama Karanth Nagar Post, Bangalore-560077', 13.059822, 77.636743, 100, '1234'),
    ('42 Queens Square Residents Welfare Association', 'Sy No. 419/1A, 418/2, 428, Sarjapur - Attibele Road, Sarjapur , Bengaluru- 562125', 12.8524686428979, 77.7832401078848, 100, '1234'),
    ('SNN RAJ LAKE VIEW APARTMENT - Gate 1', '#3761, 29th main, N.S Palya Main Road, BTM layout 2nd stage, Bangalore - 560076', 12.9040254032314, 77.6087382673447, 100, '1234'),
    ('SNN RAJ LAKE VIEW APARTMENT - Gate 2', '#3761, 29th main, N.S Palya Main Road, BTM layout 2nd stage, Bangalore - 560076', 12.9036215264115, 77.6069612542539, 100, '1234'),
    ('Mirabilis Apartment Owners Association - Entry', '1, Association office, Kolte Patil Mirabilis, Survey No 71, 29 Hormavu Agara Main road, Bengaluru, Karnataka - 560043.', 13.0320190370071, 77.6608470524337, 100, '1234'),
    ('Mirabilis Apartment Owners Association - Exit', '1, Association office, Kolte Patil Mirabilis, Survey No 71, 29 Hormavu Agara Main road, Bengaluru, Karnataka - 560043.', 13.0307320043311, 77.6620801847894, 100, '1234'),
    ('SOBHA SILICON OASIS - Gate 1', 'Hosa Rd, Doddanagamangala Village, Pragathi Nagar, Electronic City, Bengaluru, Karnataka 560100', 12.868999, 77.660516, 100, '1234'),
    ('SOBHA SILICON OASIS - Gate 2', 'Hosa Rd, Doddanagamangala Village, Pragathi Nagar, Electronic City, Bengaluru, Karnataka 560100', 12.868886, 77.660675, 100, '1234'),
    ('NIKOO HOMES 1 - Entry', 'Club House Tower 10, Nikoo Homes -1, Bhartiya City. Thanisandra Main Road, Yelahanka, Bengaluru-560064', 13.0848072159765, 77.6435134698825, 100, '1234'),
    ('NIKOO HOMES 1 - Exit', 'Club House Tower 10, Nikoo Homes -1, Bhartiya City. Thanisandra Main Road, Yelahanka, Bengaluru-560064', 13.0840801080442, 77.6454908070308, 100, '1234'),
    ('RAJA RITZ AVENUE', 'Raja Ritz Avenue, Seetharampalya, Hoodi Main Road, Bengaluru, 560048, KA, IN', 12.9890489, 77.7145403, 100, '1234'),
    ('Brigade Bricklane - Gate 1', 'Sy.No. 95 and 97, Kogilu Main Rd, near Brigade Northridge, Jakkur, Bangalore, Bengaluru, Bengaluru Urban, Karnataka-560064', 13.0977796797633, 77.6322722968037, 100, '1234'),
    ('Brigade Bricklane - Gate 2', 'Sy.No. 95 and 97, Kogilu Main Rd, near Brigade Northridge, Jakkur, Bangalore, Bengaluru, Bengaluru Urban, Karnataka-560064', 13.1003220277841, 77.6322669087906, 100, '1234'),
    ('Mahindra Windchimes', 'Ground Floor, Mahinda Windchimes Apartments, Tower 1 Wing B, 2nd Main Road, Spectra Tools, Arakere, Bengaluru, Bengaluru Urban, Karnataka, 560076', 12.8862044321071, 77.5970175167687, 100, '1234'),
    ('Luxuria Apartment owners welfare association - Entry', 'Salarpuria Sattva Luxuria', 13.0174773275646, 77.5582252104409, 100, '1234'),
    ('Luxuria Apartment owners welfare association - Exit', 'Salarpuria Sattva Luxuria', 13.0175417430974, 77.5573091889167, 100, '1234'),
    ('ELAN HOMES OWNERS ASSOCIATION - Gate 1', 'Sy # 15 & 23 kaikondarahalli village varthur hobli Bangalore East taluk Sarjapur road Bangalore 560035.', 12.917533, 77.672727, 100, '1234'),
    ('ELAN HOMES OWNERS ASSOCIATION - Gate 2', 'Sy # 15 & 23 kaikondarahalli village varthur hobli Bangalore East taluk Sarjapur road Bangalore 560035.', 12.917459, 77.672883, 100, '1234'),
    ('ELAN HOMES OWNERS ASSOCIATION - Gate 3', 'Sy # 15 & 23 kaikondarahalli village varthur hobli Bangalore East taluk Sarjapur road Bangalore 560035.', 12.918534, 77.672949, 100, '1234'),
    ('GR Sankalpa', 'GR Sankalpa Apartment Owners Welfare Association (GRSAOWS) Sy. No 63 & 77/2 Choodasandra village, sarjapura hobli, Anekal taluk, Bangalore Zone 3 Anekal-560099, Bengaluru Zone 3', 12.8884548028499, 77.6767340121865, 100, '1234'),
    ('Assetz Soul & Soil', 'Ground Floor, Sy No 43 & 45 Hennur Main Road, Chikkagubbi Bengaluru Urban - 560077', 13.077912, 77.662068, 100, '1234'),
    ('Birla Alokya', 'Floor No 1, Building No 001, Soukya Road, Koralur, Bangalore Rural 560067', 12.9902778599665, 77.7893441241976, 100, '1234'),
    ('Sobha dewflower - Entry', '4th cross road, sarakki layout jp nagar bangalore', 12.9144435526526, 77.5780234619339, 100, '1234'),
    ('Sobha dewflower - Exit', '4th cross road, sarakki layout jp nagar bangalore', 12.9136268759223, 77.5778830185729, 100, '1234'),
    ('Ahad Euphoria', 'Association office, 1st floor, Ahad euphoria, Sarjapura main road, Kodathi Village, Bangaluru-560035', 12.8948222860812, 77.7092525478122, 100, '1234'),
    ('Mahendra Aarna', 'AARNA APARTMENT ASSOCIATION Survey No. 110, Phase 01, Ananth Nagar, Kammasandra Village Road,Anantha nagar Electronic City, Bengaluru, Bengaluru Urban, Karnataka, 560100', 12.8350924461131, 77.6910325374553, 100, '1234'),
    ('SNN Raj Spiritua', 'No.67/3, No.34,, S KARIYAPPA ROAD, JARAGANAHALLI, BENGALURU URBAN, KARNATAKA, 560078', 12.9112436036841, 77.5726927603776, 100, '1234'),
    ('Brigade Omega Apartment', '80 Feet ring road, Opp Thurahalli Forest , Thalghattapura, Subramanya pura Post Bangalore 560061.', 12.8931631107487, 77.5289827099487, 100, '1234'),
    ('Mantri Elegance - Entry', 'N.S.Palya Bannerghatta Road, Bangalore-560076', 12.912871, 77.60118, 100, '1234'),
    ('Mantri Elegance - Exit', 'N.S.Palya Bannerghatta Road, Bangalore-560076', 12.911872, 77.601176, 100, '1234'),
    ('ALANOVILLE RESIDENTS WELFARE ASSOCIATION', 'Alanoville - Goyal & Co , Hariyana Group , Chikkagubbi Village , Kannuru Karnataka 560077', 13.088551, 77.659523, 100, '1234'),
    ('Prestige Oasis.', 'Prestige Oasis. Addhevishvanathapura road, Rajanukunte , Bengaluru -560064.', 13.1798947667402, 77.5578967222922, 100, '1234'),
    ('Purva sunshine apartment', 'Kaikondanahlli sarjapur main road bangaluru 560035', 12.9145487068127, 77.6765336185698, 100, '1234'),
    ('Brigade Millennium Laburnum', 'Brigade Millennium Laburnum', 12.8930719217033, 77.5819072129081, 100, '1234'),
    ('Brigade Millennium Jacaranda Block Apt Owner Association. - Gate 1', 'Jacaranda Block, Brigade Millennium JP Nagar 7th Phase, Bengaluru 560078.', 12.8930719217033, 77.5819072129081, 100, '1234'),
    ('Brigade Millennium Jacaranda Block Apt Owner Association. - Gate 2', 'Jacaranda Block, Brigade Millennium JP Nagar 7th Phase, Bengaluru 560078.', 12.8922899298821, 77.5827248177473, 100, '1234'),
    ('URBAN GREENS VILLA OWNERS WELFARE ASSOCIATION', 'Sy.No.324,326-3,326-4,327 Urban Greens,Sarjapura Baglure road,Sarjapura,Bangalore-562125', 12.8564875260863, 77.7989927912457, 100, '1234'),
    ('SHRIRAM SPURTHI APARTMENTS ASSOCIATION', 'Khatha No 180,Ward No 21,Sy No 132, Kundalahalli Village,K R Purm Hobli, Bangalore East Taluk,Brook Field, Bengaluru Urban Karnataka, 560037', 12.9668245641689, 77.7139068392894, 100, '1234'),
    ('Mantri premero', 'Sarjupur main road near Wipro corporate office doddakannelli bangalore-560035', 12.9067837196747, 77.6936985977416, 100, '1234'),
    ('Aratt Milano', 'Aratt Milano, Gattahalli, Ghattihalli, Karnataka 560099', 12.8675352772187, 77.6977019683549, 100, '1234'),
    ('NVT Life Square', 'Nagandanahali, Whitefeld, Bengalore 560066', 12.9752732784067, 77.7649185798322, 100, '1234'),
    ('DSR WoodWinds Apartment Owners Association', '83/3, DSR Woodwinds, Sarjapur Road, Doddakannelli, Bengaluru (Bangalore) Urban, Karnataka, 560035', 12.9099327410467, 77.6872848883724, 100, '1234'),
    ('MARATT PIMENTO - Gate 1', 'No 18/583/440/336 Former Survey No 174/2, Bilekanahalli Village Begur Hobli Bangalore South Taluk, Karnataka -560076', 12.90646, 77.600826, 100, '1234'),
    ('MARATT PIMENTO - Gate 2', 'No 18/583/440/336 Former Survey No 174/2, Bilekanahalli Village Begur Hobli Bangalore South Taluk, Karnataka -560076', 12.906136, 77.601168, 100, '1234'),
    ('Kolte Patil I Tower Exente', 'Sy No. 30/3,30/4 and 35/1, konappana Agrahara, 439, Electronic City Bengaluru 560100', 12.849628, 77.669877, 100, '1234'),
    ('Pride Picassa Apartment', 'No.214,Pride Picassa Apartment ,Domlur 2nd stage,Bangalore-560071', 12.9658090121001, 77.6376910476446, 100, '1234'),
    ('ICON SANCTUARY VILLA OWNERS WELFEARASSOCIATION', 'SURVEY 190/,57/4,61/2,62/1,62/2,62/5,62/6,57/3, THINDLU VILLAGE,SARJAPURA HOBLI, ANEKAL TALUK,BENGALURU,URBAN DISTRICT-562125, KARNATAKA,CODE : 29', 12.8556233, 77.8099909, 100, '1234'),
    ('Artisane forest breeze - Gate 1', 'No.103/1036/941/764/882/3, Artisane Forest Breeze, Doraisanipalya, Bilekahalli, Bengaluru, Bengaluru Urban, Karnataka, 560076', 12.8994312503073, 77.5948233479567, 100, '1234'),
    ('Artisane forest breeze - Gate 2', 'No.103/1036/941/764/882/3, Artisane Forest Breeze, Doraisanipalya, Bilekahalli, Bengaluru, Bengaluru Urban, Karnataka, 560076', 12.8980101675525, 77.5946826285207, 100, '1234'),
    ('DSR Eden Greens', 'Carmaleram Station Road, Doddakkannelli Sarjapur Road ,Bangalore -560035', 12.9080687128011, 77.705494058412, 100, '1234'),
    ('Sjr Spencer', 'No.80, 4th Cross Road, Lakshminarayana Pura, Aswath Nagar, Marathahalli, Bengaluru,', 12.9573549495198, 77.7043587420398, 100, '1234'),
    ('Prestige Garden Bay', 'Avalahalli Village, IVRI Road, Doddaballapura Road, Behind CRPF, Yalahanka Bangalore - 560064', 13.1278753300029, 77.5624258130085, 100, '1234'),
    ('Purva Venezia Apartment - Gate 1', 'Purva Venezia apartment owners association D Block major Sandeep Unnikrishnan road, Yelahanka new town Bangalore - 560054', 13.0977265578326, 77.5702844757861, 100, '1234'),
    ('Purva Venezia Apartment - Gate 2', 'Purva Venezia apartment owners association D Block major Sandeep Unnikrishnan road, Yelahanka new town Bangalore - 560054', 13.0963981658042, 77.5698194008601, 100, '1234'),
    ('Sterling Terraces - Gate 1', 'Sterling Terraces owners welfare association, No 3 Dr Puneeth Rajkumar road 3rd stage Banashankari , bangaluru - 560085', 12.9276405895805, 77.546727805028, 100, '1234'),
    ('Sterling Terraces - Gate 2', 'Sterling Terraces owners welfare association, No 3 Dr Puneeth Rajkumar road 3rd stage Banashankari , bangaluru - 560085', 12.9272687885385, 77.5468847810032, 100, '1234'),
    ('Sterling Terraces - Gate 3', 'Sterling Terraces owners welfare association, No 3 Dr Puneeth Rajkumar road 3rd stage Banashankari , bangaluru - 560085', 12.9266490381954, 77.5452303822596, 100, '1234'),
    ('Fame India (Nadathur Foundation) - Gate 1', 'Plot No. 23, Nadathur Place, 3rd Floor, 8th Main Road, Jayanagar 3rd block, Bangalore', 12.86612, 77.536499, 100, '1234'),
    ('Fame India (Nadathur Foundation) - Gate 2', 'Plot No. 23, Nadathur Place, 3rd Floor, 8th Main Road, Jayanagar 3rd block, Bangalore', 12.866254, 77.536402, 100, '1234'),
    ('Fame India (Nadathur Foundation) - Gate 3', 'Plot No. 23, Nadathur Place, 3rd Floor, 8th Main Road, Jayanagar 3rd block, Bangalore', 12.866142, 77.536072, 100, '1234'),
    ('Aratt Aeris - Gate 1', '# 10/3 80 ft Road Michael Palya CV Raman General Hospital Opp Indiranagar Bangalore karnataka 560023', 12.9825369619356, 77.6459293490273, 100, '1234'),
    ('Tata sherwood', 'No.15, Cypress sherwood Basavanagar main road vibhuti pura Extension Bangalore - 560037', 12.9689539603138, 77.6845337110061, 100, '1234'),
    ('Jyothi Woods', 'SYNO 44/1 A1, Chinnapanahalli Village, K.R.Puram ( Hobli), Bangalore - 560037', 12.9657163315074, 77.709246227838, 100, '1234'),
    ('Habitat Eden Heights', 'No. 187, Hoodi, Graphite Main Road, Hood, Circle , Whitefield, Bangalore- 560048', 12.990447, 77.714438, 100, '1234'),
    ('August Park Apartment', 'No.3, 1st B-Cross, Kaggadasapura Main Road, C.V. Raman Nagar, Bangalore - 560093', 12.9873257707023, 77.670390447089, 100, '1234'),
    ('Shriram Signiaa Apartment', 'Neeladri Rd, Electronics City Phase 1, Electronic City, Doddathoguru, Bangalore-560100', 12.8392056524266, 77.6564057861157, 100, '1234'),
    ('Vaishnavi Terraces Apartment Owners association - Gate 1', 'VAISHNAVI TERRACES APARTMENT OWNERS ASSOCIATION 4th Cross, Dollars Colony, JP Nagar 4th Phase Bengaluru-560078', 12.9033174017739, 77.6001280395775, 100, '1234'),
    ('Vaishnavi Terraces Apartment Owners association - Gate 2', 'VAISHNAVI TERRACES APARTMENT OWNERS ASSOCIATION 4th Cross, Dollars Colony, JP Nagar 4th Phase Bengaluru-560078', 12.9038039170936, 77.5989555037297, 100, '1234'),
    ('MJ Lifestyle Amadeus', 'S Avenue Road, Rayasandra main road, Chikkanagamangala village, Bangalore - 560099', 12.8670932205853, 77.6876984200251, 100, '1234'),
    ('SHRIRAM SMRITHI - Gate 1', 'SARJAPUR-ATTIBELE ROAD,BIDARAGUPPE,ATTIBELE HOBLI,BANGALORE 562107', 12.811435, 77.78431, 100, '1234'),
    ('SHRIRAM SMRITHI - Gate 2', 'SARJAPUR-ATTIBELE ROAD,BIDARAGUPPE,ATTIBELE HOBLI,BANGALORE 562107', 12.812083, 77.78296, 100, '1234')
) AS v(name, address, latitude, longitude, radius, kiosk_pin)
WHERE NOT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.name = v.name
       OR (ABS(l.latitude - v.latitude) < 0.00008 AND ABS(l.longitude - v.longitude) < 0.00008)
);

-- Verify inserted count
SELECT COUNT(*) AS total_existing_locations FROM public.locations;