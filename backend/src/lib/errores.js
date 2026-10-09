// Error con código HTTP. Lánzalo desde cualquier ruta o servicio y el
// errorHandler lo convierte en la respuesta adecuada.
export class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

export const noEncontrado = (que) => new HttpError(404, `${que} no encontrado`);
export const solicitudInvalida = (mensaje, detalles) => new HttpError(400, mensaje, detalles);
