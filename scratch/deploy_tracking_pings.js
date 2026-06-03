import fs from 'fs';

const projectRef = 'fmyafuhxlorbafbacywa';
const token = 'sbp_31794f229b16a21a9992df7024b7feb71c4b0d05';

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
  // Try PATCH first
  let res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/${slug}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = await res.json();
  
  if (!res.ok) {
    if (res.status === 404) {
      console.log(`${slug} does not exist, creating via POST...`);
      res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      data = await res.json();
      if (!res.ok) {
        console.error(`Error creating ${slug}:`, data);
        throw new Error(`Failed to create ${slug}`);
      }
      console.log(`Successfully created and deployed ${slug}!`);
      return data;
    }
    
    console.error(`Error deploying ${slug}:`, data);
    throw new Error(`Failed to deploy ${slug}`);
  } else {
    console.log(`Successfully updated and deployed ${slug}!`);
    return data;
  }
}

try {
  await deploy('send-notification', 'supabase/functions/send-notification/index.ts');
  await deploy('process-automated-pings', 'supabase/functions/process-automated-pings/index.ts');
  console.log('--- DEPLOYMENTS FINISHED ---');
} catch (err) {
  console.error('Deployment failed:', err.message);
  process.exit(1);
}
