import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPlainObject', async: false })
export class IsPlainObjectConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    return !Array.isArray(value);
  }

  defaultMessage(): string {
    return 'payload must be a non-null object';
  }
}

export function IsPlainObject(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPlainObjectConstraint,
    });
  };
}
