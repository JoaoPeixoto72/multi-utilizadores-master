/**
 * lib/utils/image.ts
 * Utilitário isolado e reutilizável para manipulação de imagens (Resize e Conversão WebP)
 * no lado do Cliente (Browser). 
 * Extracável para qualquer outro projecto SvelteKit ou VanillaJS.
 */

interface OptimizeImageOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0.0 to 1.0 (default 0.8)
    format?: "image/webp" | "image/jpeg" | "image/png";
}

export async function optimizeImage(
    file: File,
    options: OptimizeImageOptions = {}
): Promise<File> {
    const {
        maxWidth = 512,
        maxHeight = 512,
        quality = 0.8,
        format = "image/webp",
    } = options;

    // Se já for do formato ideal e pequeno o suficiente, há quem queira apenas retornar.
    // Porém, por segurança, re-escrevemos sempre para garantir limites e limpar EXIF/metadata.

    return new Promise((resolve, reject) => {
        // 1. Converter File em OURL
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // 2. Calcular novas dimensões mantendo o aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }

            // 3. Desenhar num Canvas (Memory-only)
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Não foi possível criar o contexto 2D."));
                return;
            }

            // Se a imagem tiver transparência mas for exportada como JPEG, o fundo fica preto.
            // Damos-lhe um fallback transparente para PNG/WebP, ou não faz mal pois WebP suporta transparência.
            ctx.drawImage(img, 0, 0, width, height);

            // 4. Exportar como Blob no formato e qualidade pedidos
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Falha ao exportar a imagem optimizada."));
                        return;
                    }

                    // 5. Reconstruir um objecto File
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const optimizedFile = new File([blob], newFileName, {
                        type: format,
                        lastModified: Date.now(),
                    });

                    resolve(optimizedFile);
                },
                format,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Ficheiro inválido ou não é uma imagem suportada."));
        };

        img.src = url;
    });
}
