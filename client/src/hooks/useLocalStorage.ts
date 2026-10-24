import { useEffect, useState } from 'react'

// Igual ao useState, mas guarda o valor no navegador para não perder ao recarregar a página.
// Uso temporário: quando o backend estiver pronto, esses dados vão para o banco.
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initialValue : (JSON.parse(stored) as T)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Se o navegador bloquear o armazenamento, o app continua funcionando sem salvar
    }
  }, [key, value])

  return [value, setValue] as const
}
