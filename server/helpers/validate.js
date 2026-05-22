export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors.map(e => e.message).join(', ') };
  }
  return { data: result.data };
}

export default { validate };
