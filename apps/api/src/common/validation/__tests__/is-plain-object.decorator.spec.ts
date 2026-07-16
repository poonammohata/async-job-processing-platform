import { validate } from 'class-validator';
import { IsPlainObject } from '../is-plain-object.decorator';

class PayloadDto {
  @IsPlainObject()
  payload!: unknown;
}

describe('IsPlainObject', () => {
  it('accepts a plain object', async () => {
    const dto = new PayloadDto();
    dto.payload = { key: 'value' };

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts an empty object', async () => {
    const dto = new PayloadDto();
    dto.payload = {};

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects null', async () => {
    const dto = new PayloadDto();
    dto.payload = null;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isPlainObject).toBe(
      'payload must be a non-null object',
    );
  });

  it('rejects arrays', async () => {
    const dto = new PayloadDto();
    dto.payload = ['item'];

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isPlainObject).toBe(
      'payload must be a non-null object',
    );
  });

  it('rejects non-object values', async () => {
    const dto = new PayloadDto();
    dto.payload = 'string';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
