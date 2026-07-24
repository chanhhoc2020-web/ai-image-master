export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'HF_TOKEN environment variable is not set on Vercel.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, payload } = await req.json();

    let modelUrl = '';
    let response;

    if (action === 'text-to-image') {
      modelUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';
      response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: errorText }), { status: response.status });
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: { 'Content-Type': blob.type },
      });

    } else if (action === 'image-to-image') {
      modelUrl = 'https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix';
      
      const { base64, mimeType } = payload;
      let data = base64;
      if (base64.includes('base64,')) {
        data = base64.split(',')[1];
      }
      
      const byteString = atob(data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType || 'image/png' });

      response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': mimeType || 'image/png',
        },
        body: blob,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: errorText }), { status: response.status });
      }

      const resBlob = await response.blob();
      const arrayBuffer = await resBlob.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: { 'Content-Type': resBlob.type },
      });

    } else if (action === 'text-generation') {
      modelUrl = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
      response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: errorText }), { status: response.status });
      }
      
      const json = await response.json();
      return new Response(JSON.stringify(json), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
