import { isProblemDetails, isValidationProblemDetails } from './problem-details.guards';

const problem = {
  type: 'https://schedulemanager/errors/conflict',
  title: 'Conflito',
  status: 409,
  code: 'appointment.slot_unavailable',
  traceId: 'abc-123',
};

describe('problem-details guards', () => {
  it('reconhece ProblemDetails a partir de unknown', () => {
    expect(isProblemDetails(problem)).toBe(true);
    expect(isProblemDetails({ ...problem, detail: 'Horário ocupado.' })).toBe(true);
  });

  it('rejeita valores que não são ProblemDetails', () => {
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails('erro')).toBe(false);
    expect(isProblemDetails({ status: 500 })).toBe(false);
    expect(isProblemDetails({ ...problem, code: 42 })).toBe(false);
  });

  it('reconhece ValidationProblemDetails com errors: Record<string, string[]>', () => {
    const validation = {
      ...problem,
      status: 400,
      code: 'validation.failed',
      errors: { 'address.city': ['Obrigatório.'], email: ['Inválido.'] },
    };
    expect(isValidationProblemDetails(validation)).toBe(true);
  });

  it('rejeita errors mal formado', () => {
    expect(isValidationProblemDetails({ ...problem, errors: { email: 'Inválido.' } })).toBe(false);
    expect(isValidationProblemDetails(problem)).toBe(false);
  });
});
