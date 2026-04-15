export const MIN_PASSWORD_LENGTH = 8;
export const ALLOWED_SPECIAL_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?`~";

const fullNameRegex = /^[А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+){1,2}$/;
const allowedPasswordCharsRegex =
  /^[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;
const uppercaseLetterRegex = /[A-Z]/;
const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

/** Нормализует email для хранения и поиска (без ведущих/хвостовых пробелов, в нижнем регистре). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailFormatRegex =
  /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export function getEmailValidationError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Введите email.";
  }

  if (trimmed.length > 254) {
    return "Email слишком длинный.";
  }

  const normalized = normalizeEmail(email);
  if (!emailFormatRegex.test(normalized)) {
    return "Некорректный формат email.";
  }

  return null;
}

export function getFullNameValidationError(fullName: string): string | null {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "Введите ФИО.";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) {
    return "ФИО должно содержать 2 или 3 слова.";
  }

  if (!/^[А-Яа-яЁё\s]+$/.test(trimmed)) {
    return "ФИО должно содержать только русские буквы и пробелы.";
  }

  if (!parts.every((part) => /^[А-ЯЁ][а-яё]+$/.test(part))) {
    return "Каждое слово ФИО должно начинаться с заглавной буквы и далее содержать строчные.";
  }

  if (!fullNameRegex.test(trimmed)) {
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
