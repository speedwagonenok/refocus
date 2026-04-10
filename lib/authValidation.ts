export const MIN_PASSWORD_LENGTH = 8;
export const ALLOWED_SPECIAL_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?`~";

const fullNameRegex = /^[А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+){1,2}$/;
const allowedPasswordCharsRegex =
  /^[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;
const uppercaseLetterRegex = /[A-Z]/;
const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function isValidFullName(fullName: string): boolean {
  return fullNameRegex.test(fullName.trim());
}

export function isValidPassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }

  return (
    allowedPasswordCharsRegex.test(password) &&
    uppercaseLetterRegex.test(password) &&
    specialCharRegex.test(password)
  );
}

export function getFullNameValidationError(fullName: string): string | null {
  const trimmedFullName = fullName.trim();
  if (!trimmedFullName) {
    return "Введите ФИО.";
  }

  const parts = trimmedFullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) {
    return "ФИО должно содержать 2 или 3 слова.";
  }

  if (!/^[А-Яа-яЁё\s]+$/.test(trimmedFullName)) {
    return "ФИО должно содержать только русские буквы и пробелы.";
  }

  if (!parts.every((part) => /^[А-ЯЁ][а-яё]+$/.test(part))) {
    return "Каждое слово ФИО должно начинаться с заглавной буквы и далее содержать строчные.";
  }

  if (!isValidFullName(trimmedFullName)) {
    return "Некорректный формат ФИО.";
  }

  return null;
}

export function getPasswordValidationError(password: string): string | null {
  if (!password) {
    return "Введите пароль.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`;
  }

  if (!allowedPasswordCharsRegex.test(password)) {
    return `Пароль может содержать только английские буквы, цифры и спецсимволы (${ALLOWED_SPECIAL_SYMBOLS}).`;
  }

  if (!uppercaseLetterRegex.test(password)) {
    return "Пароль должен содержать хотя бы одну заглавную английскую букву.";
  }

  if (!specialCharRegex.test(password)) {
    return `Пароль должен содержать хотя бы один спецсимвол (${ALLOWED_SPECIAL_SYMBOLS}).`;
  }

  return null;
}
