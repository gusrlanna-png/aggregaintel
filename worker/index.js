// Custom worker injetado pelo next-pwa no service worker gerado.
// Implementa o Web Share Target: recebe o arquivo compartilhado (NF) do Android,
// guarda no Cache Storage e redireciona para /nf/nova?compartilhado=1, onde a
// página lê o arquivo e injeta no fluxo de OCR.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "POST") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.pathname !== "/nf/nova") return;

  event.respondWith(
    (async () => {
      try {
        const form = await req.formData();
        const file = form.get("file");
        if (file && typeof file !== "string" && file.size > 0) {
          const cache = await caches.open("share-nf");
          await cache.put(
            "shared-file",
            new Response(file, {
              headers: {
                "content-type": file.type || "image/jpeg",
                "x-filename": file.name || "nf.jpg",
              },
            })
          );
        }
      } catch {
        /* ignora — segue para a tela mesmo sem arquivo */
      }
      return Response.redirect("/nf/nova?compartilhado=1", 303);
    })()
  );
});
