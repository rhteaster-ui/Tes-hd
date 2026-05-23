const API = "https://api.ezremove.ai/api/ez-remove/ai-enhance/create-job-v2";

const DEFAULT_IMAGE =
  "https://raw.githubusercontent.com/rhteaster-ui/Samph/refs/heads/main/e1d350e1-673b-46f4-9c68-f36ecc188e4c.jpeg";

function rid() {
  return `browser_${Date.now()}_${Math.random().toString(36).slice(2, 13)}`;
}

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      status: false,
      code: 405,
      creator: "rhmt",
      error: "Method harus POST",
    });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      return json(res, 400, {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "Body JSON tidak valid",
      });
    }

    const imageUrl = String(body.imageUrl || DEFAULT_IMAGE).trim();
    const resolution = String(body.resolution || "16K").trim().toUpperCase();
    const model = String(body.model || "upscale_fast").trim();

    if (!/^https?:\/\//i.test(imageUrl)) {
      return json(res, 400, {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "Image URL kosong / tidak valid",
      });
    }

    const allowed = new Set(["2K", "4K", "8K", "16K"]);
    if (!allowed.has(resolution)) {
      return json(res, 400, {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "Resolusi hanya 2K, 4K, 8K, atau 16K",
      });
    }

    const form = new FormData();
    form.append("original_image_url", imageUrl);
    form.append("model", model);
    form.append("params", JSON.stringify({ target_resolution: resolution }));

    const upstream = await fetch(API, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "product-serial": rid(),
        origin: "https://ezremove.ai",
        referer: "https://ezremove.ai/",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
      },
      body: form,
    });

    const text = await upstream.text();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return json(res, upstream.status, {
        status: false,
        code: upstream.status,
        creator: "rhmt",
        error: "Response upstream bukan JSON",
        raw: text.slice(0, 1200),
      });
    }

    if (raw?.code !== 100000) {
      return json(res, 200, {
        status: false,
        code: upstream.status,
        creator: "rhmt",
        input: imageUrl,
        model,
        resolution,
        error: raw?.message || raw?.msg || "Gagal upscale image",
        raw,
      });
    }

    return json(res, 200, {
      status: true,
      code: 200,
      creator: "rhmt",
      input: imageUrl,
      model,
      resolution,
      jobId: raw?.result?.job_id || null,
      imageUrl: raw?.result?.image_url || null,
      raw,
    });
  } catch (err) {
    return json(res, 500, {
      status: false,
      code: 500,
      creator: "rhmt",
      error: err.message || "Terjadi kesalahan",
    });
  }
};
