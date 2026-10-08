const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

async function test() {
  const { data } = await supabase.from("onboarding_submissions").select("*");
  const southWallKeywords = ["south wall", "southwall", "south-wall", "swllp", "comp_1774527590821"];
  const southWallSites = [
    "gk_ispat", "gk ispat", "iskcon", "habitat_aura", "habitat aura", "keshav_setlur", "keshav setlur",
    "nikoo_homes", "nikoo homes", "brigade_jacaranda", "brigade jacaranda", "brigade_laburnum", "brigade laburnum",
    "dsr_eden_greens", "dsr eden greens", "global_edifice_infra", "global edifice", "habitat_eden_heights", "eden heights",
    "icon_sanctury", "icon sanctuary", "nadathur_fame_india", "nadathur", "paliwal_ttn", "paliwal", "purva_sunshine",
    "purva sunshine", "raja_ritz_avenue", "raja ritz", "serene_brigade", "shriram_smrithi", "shriram smrithi",
    "shriram_spurthi", "shriram spurthi", "sjr_spencer", "sjr spencer", "snn_spiritua", "snn spiritua"
  ];

  data.forEach((row, i) => {
    const s = row.form_data || {};
    const orgObj = s.organization || {};
    const orgName = String(row.organization_name || s.organizationName || orgObj.organizationName || "").toLowerCase();
    const site = String(row.site || orgObj.site || orgObj.location || "").toLowerCase();
    const compName = String(row.company_name || row.companyName || orgObj.companyName || orgObj.companyId || "").toLowerCase();
    const dept = String(row.department || orgObj.department || "").toLowerCase();
    const des = String(row.designation || orgObj.designation || "").toLowerCase();
    const empId = String(row.employee_id || s.personal?.employeeId || s.employeeId || "").toUpperCase();

    const matchesKeyword = southWallKeywords.some(kw => 
      orgName.includes(kw) || site.includes(kw) || compName.includes(kw) || dept.includes(kw) || des.includes(kw)
    );
    const matchesSite = southWallSites.some(st => 
      orgName.includes(st) || site.includes(st)
    );
    const isSecurity = dept.includes("security") || des.includes("security") || des.includes("guard");

    console.log(`[${(i+1).toString().padStart(2)}] ${empId.padEnd(10)} | Site: ${site.padEnd(28)} | Des: ${des.padEnd(22)} | Dept: ${dept.padEnd(18)} | Sec: ${isSecurity}`);
  });
}
test();
