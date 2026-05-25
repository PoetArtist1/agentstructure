import { useEffect, useRef } from 'react'

/**
 * Hook personalizado que observa elementos y les agrega la clase 'visible'
 * cuando entran al viewport (Intersection Observer API).
 * Se usa para animaciones de entrada tipo fade-in.
 */
export function useIntersectionObserver(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    )

    // Observa el nodo y todos los hijos con clase fade-target
    const targets = node.querySelectorAll('.fade-target')
    targets.forEach((el) => observer.observe(el))
    if (node.classList.contains('fade-target')) observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return ref
}
