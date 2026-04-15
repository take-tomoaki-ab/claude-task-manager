import { useState, useRef, useEffect, useCallback } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  branches: string[]
  allowNew?: boolean
  placeholder?: string
  className?: string
  required?: boolean
}

export function BranchCombobox({
  value,
  onChange,
  branches,
  allowNew = true,
  placeholder,
  className,
  required,
}: Props) {
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // 外から value が変わったとき同期
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const filtered = branches.filter((b) =>
    b.toLowerCase().includes(inputValue.toLowerCase())
  )

  // allowNew=false のとき: 先頭に「HEAD から分岐」を含む候補リストを作成
  // allowNew=true のとき: filtered のみ
  const options = allowNew ? filtered : filtered

  const commitSelection = useCallback(
    (selected: string) => {
      setInputValue(selected)
      onChange(selected)
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [onChange]
  )

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
        if (!allowNew) {
          // strict モード: 既存ブランチに存在しない値は空文字にリセット
          if (inputValue !== '' && !branches.includes(inputValue)) {
            setInputValue('')
            onChange('')
          }
        }
      }
    },
    [inputValue, branches, allowNew, onChange]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  // ハイライト項目をリスト内にスクロール
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLLIElement>('li[data-idx]')
    const target = items[highlightedIndex]
    target?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputValue(v)
    if (allowNew) {
      onChange(v)
    }
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
        return
      }
    }

    // allowNew=false の場合: インデックス 0 が「HEAD から分岐」の特別アイテム
    const totalItems = allowNew ? options.length : options.length + 1
    const emptyItemOffset = allowNew ? 0 : 1 // インデックス0がHEADアイテム分のオフセット

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0) {
          if (!allowNew && highlightedIndex === 0) {
            commitSelection('')
          } else {
            const branch = options[highlightedIndex - emptyItemOffset]
            if (branch) commitSelection(branch)
          }
        } else if (allowNew) {
          // Enter でそのまま確定
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const itemBaseClass = 'px-3 py-1.5 text-sm text-white cursor-pointer'
  const itemHighlightClass = 'bg-blue-600'
  const itemHoverClass = 'hover:bg-gray-600'

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {!allowNew && (
            <li
              onClick={() => commitSelection('')}
              className={`${itemBaseClass} ${itemHoverClass} text-gray-400 italic ${
                highlightedIndex === 0 ? itemHighlightClass : ''
              }`}
            >
              （HEAD から分岐）
            </li>
          )}
          {options.map((b, i) => {
            const idx = allowNew ? i : i + 1
            return (
              <li
                key={b}
                data-idx={idx}
                onClick={() => commitSelection(b)}
                className={`${itemBaseClass} ${itemHoverClass} ${
                  highlightedIndex === idx ? itemHighlightClass : ''
                }`}
              >
                {b}
              </li>
            )
          })}
          {!allowNew && options.length === 0 && inputValue && (
            <li className="px-3 py-1.5 text-sm text-gray-400">
              一致するブランチなし
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
