import fs from 'fs';

const projectRef = 'fmyafuhxlorbafbacywa';
const token = 'sbp_b5ff4efa2504c0e3e0c16bedb2ae154972d574fc';

async function deploy(slug, filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const payload = {
    slug,
    name: slug,
    verify_jwt: false,
    import_map: false,
    body: code
  };

  console.log(`Deploying ${slug}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/${slug}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Error deploying ${slug}:`, data);
    throw new Error(`Failed to deploy ${slug}`);
  } else {
    console.log(`Successfully deployed ${slug}!`);
    return data;
  }
}

try {
  await deploy('send-email', 'supabase/functions/send-email/index.ts');
  await deploy('process-notification-rules', 'supabase/functions/process-notification-rules/index.ts');
  console.log('--- ALL DEPLOYMENTS FINISHED ---');
} catch (err) {
  console.error('Deployment failed:', err.message);
  process.exit(1);
}
