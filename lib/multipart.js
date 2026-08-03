import Busboy from "busboy";

/**
 * Parses a multipart/form-data request into { fields, files } without
 * depending on Express or multer, neither of which apply to raw Vercel
 * serverless functions. Uses busboy — a minimal, well-established streaming
 * multipart parser — rather than hand-rolling multipart parsing, since
 * getting that subtly wrong risks silently corrupting uploaded file bytes
 * (the same category of risk that led to using adm-zip instead of a
 * hand-rolled zip parser earlier in this project).
 *
 * Enforces the same size/count limits at the parser level (not just after
 * the fact) so a malicious or oversized upload gets rejected before it's
 * fully buffered into memory.
 */
export function parseMultipartForm(req, { maxFileSize, maxFiles } = {}) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: maxFileSize,
        files: maxFiles
      }
    });

    const fields = {};
    const files = [];
    let rejected = false;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, stream, info) => {
      const chunks = [];
      let size = 0;

      stream.on("data", (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      stream.on("limit", () => {
        rejected = true;
      });

      stream.on("end", () => {
        if (rejected) return;
        files.push({ fieldname: name, originalname: info.filename, buffer: Buffer.concat(chunks), size });
      });
    });

    busboy.on("filesLimit", () => {
      rejected = true;
    });

    busboy.on("finish", () => {
      if (rejected) {
        reject(new Error("Upload exceeded size or file-count limits"));
      } else {
        resolve({ fields, files });
      }
    });

    busboy.on("error", reject);

    req.pipe(busboy);
  });
}
