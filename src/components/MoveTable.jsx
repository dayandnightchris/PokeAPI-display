import React, { useState } from 'react'
import { getTypeColor, getTypeTextColor } from '../utils/typeColors'
import { titleCase } from '../utils/format'

function CollapsibleInfoBox({ title, children, className = '', style, contentClassName = '', contentStyle, headerExtra, initialExpanded = false }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(initialExpanded)

  const hasMaxHeight = contentStyle && contentStyle.maxHeight != null

  const effectiveContentStyle = expanded && hasMaxHeight
    ? { ...contentStyle, maxHeight: 'none', overflowY: 'visible' }
    : contentStyle

  return (
    <div className={`info-box ${className}`} style={style}>
      <div className="box-title collapsible-title">
        <span>{title}</span>
        <div className="collapsible-title-buttons">
          {headerExtra}
          {hasMaxHeight && !collapsed && (
            <button
              type="button"
              className="expand-toggle"
              onClick={() => setExpanded(prev => !prev)}
              title={expanded ? 'Collapse to scrollable view' : 'Expand to show all rows'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? (
                  <>
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                ) : (
                  <>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`collapse-toggle-icon${collapsed ? ' collapse-toggle-flipped' : ''}`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#333" strokeWidth="4" />
              <path d="M2,50 A48,48 0 0,1 98,50 Z" fill="#ff0000" stroke="#333" strokeWidth="4" />
              <path d="M2,50 A48,48 0 0,0 98,50 Z" fill="#fff" stroke="#333" strokeWidth="4" />
              <rect x="2" y="47" width="96" height="6" fill="#333" />
              <circle cx="50" cy="50" r="12" fill="#fff" stroke="#333" strokeWidth="4" />
              <circle cx="50" cy="50" r="5" fill="#333" />
            </svg>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={`box-content ${contentClassName}`} style={effectiveContentStyle}>
          {children}
        </div>
      )}
    </div>
  )
}

const formatMoveLabel = (value) => {
  if (!value) return 'N/A'
  if (value === 'unknown') return '???'
  return titleCase(value)
}

const getMoveEffectEntry = (details) => {
  if (!details) return 'N/A'
  const entry = (details.effect_entries || []).find(e => e.language?.name === 'en')
  if (!entry) return 'N/A'
  const baseText = entry.short_effect || entry.effect || 'N/A'
  if (details.effect_chance == null) return baseText
  return baseText.replaceAll('$effect_chance', details.effect_chance)
}

// In Gens 1-3 move category was determined by type, not per-move
const physicalTypes = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const specialTypes = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])

function getMoveCategoryForGen(move, generationNum) {
  // Gens 1-3: category is based on type, not the move's own damage_class
  if (generationNum && generationNum <= 3) {
    const typeName = move.details?.type?.name
    if (!typeName) return move.details?.damage_class?.name || null
    // Status moves remain status regardless of generation
    if (move.details?.damage_class?.name === 'status') return 'status'
    if (physicalTypes.has(typeName)) return 'physical'
    if (specialTypes.has(typeName)) return 'special'
  }
  return move.details?.damage_class?.name || null
}

export default function MoveTable({ title, moves, showLevel, showTmNumber, showMethod, loading, onMoveClick, onEggMoveParentsClick, onNavigateToEggTab, compact, generationNum }) {
  const [sortConfig, setSortConfig] = useState({
    key: showLevel ? 'level' : showTmNumber ? 'tmNumber' : 'name',
    direction: 'asc'
  })

  const hasSourceGames = moves.some(m => m.sourceGames)

  const methodDisplayNames = {
    'light-ball-egg': 'Light Ball Egg',
    'colosseum-purification': 'Colosseum Purification',
    'xd-purification': 'XD Purification',
    'stadium-surfing-pikachu': 'Stadium',
    'form-change': 'Form Change',
    'zygarde-cube': 'Zygarde Cube',
  }

  const allColumns = [
    ...(showLevel ? [{ key: 'level', label: compact ? 'Lv' : 'Level', numeric: true }] : []),
    ...(showTmNumber ? [{ key: 'tmNumber', label: 'TM#', numeric: true }] : []),
    ...(showMethod ? [{ key: 'learnMethod', label: compact ? 'Mthd' : 'Method' }] : []),
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'effect', label: 'Effect Entry' },
    { key: 'category', label: compact ? 'Cat' : 'Category' },
    { key: 'power', label: compact ? 'Pow' : 'Power', numeric: true },
    { key: 'pp', label: 'PP', numeric: true },
    { key: 'accuracy', label: compact ? 'Acc' : 'Accuracy', numeric: true },
    { key: 'priority', label: compact ? 'Pri' : 'Priority', numeric: true },
    ...(onEggMoveParentsClick ? [{ key: 'parents', label: 'Parents' }] : []),
    ...(hasSourceGames ? [{ key: 'sourceGames', label: 'Game' }] : []),
  ]

  // In compact mode, effect becomes a sub-row instead of a column
  const columns = compact ? allColumns.filter(c => c.key !== 'effect') : allColumns

  const handleSort = (key) => {
    setSortConfig(prev => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction }
    })
  }

  const getSortValue = (move, key) => {
    switch (key) {
      case 'level':
        return move.level ?? null
      case 'tmNumber':
        return move.tmNumber ?? null
      case 'name':
        return move.name
      case 'type':
        return move.details?.type?.name
      case 'effect':
        return getMoveEffectEntry(move.details)
      case 'category':
        return getMoveCategoryForGen(move, generationNum)
      case 'power':
        return move.details?.power
      case 'pp':
        return move.details?.pp
      case 'accuracy':
        return move.details?.accuracy
      case 'priority':
        return move.details?.priority
      case 'sourceGames':
        return move.sourceGames ?? ''
      case 'learnMethod':
        return move.learnMethod ?? ''
      case 'parents':
        return move.name
      //case 'introduced':
        //return move.details?.generation?.name
      default:
        return null
    }
  }

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedMoves = [...moves].sort((a, b) => {
    const valueA = getSortValue(a, sortConfig.key)
    const valueB = getSortValue(b, sortConfig.key)

    if (valueA == null && valueB == null) return 0
    if (valueA == null) return 1
    if (valueB == null) return -1

    let result = 0
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      result = valueA - valueB
    } else {
      result = String(valueA).localeCompare(String(valueB))
    }

    return sortConfig.direction === 'asc' ? result : -result
  })

  const renderCell = (move, key) => {
    switch (key) {
      case 'level':
        return move.level ?? 'N/A'
      case 'tmNumber':
        return move.tmLabel || (move.tmNumber ? String(move.tmNumber).padStart(2, '0') : 'N/A')
      case 'name':
        const nameEl = onMoveClick
          ? <button type="button" className="move-name-link" onClick={() => onMoveClick(move.name)}>{formatMoveLabel(move.name)}</button>
          : formatMoveLabel(move.name)
        return move.inheritedFrom
          ? <>{nameEl} <span style={{ fontSize: '10px', color: '#888' }}>({(Array.isArray(move.inheritedFrom) ? move.inheritedFrom.map(n => formatMoveLabel(n)).join(' / ') : formatMoveLabel(move.inheritedFrom))})</span></>
          : nameEl
      case 'type': {
        const typeName = move.details?.type?.name
        if (!typeName) return 'N/A'
        const bg = getTypeColor(typeName)
        const fg = getTypeTextColor(typeName)
        return (
          <span className="move-type-badge" style={{
            backgroundColor: bg,
            color: fg,
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: 'inherit',
            fontWeight: 600,
            textTransform: 'capitalize',
            whiteSpace: 'nowrap',
            opacity: 0.85,
            display: 'inline-block',
            textAlign: 'center',
            width: '62px',
            overflow: 'hidden'
          }}>
            {formatMoveLabel(typeName)}
          </span>
        )
      }
      case 'effect':
        return getMoveEffectEntry(move.details)
      case 'category': {
        const cat = getMoveCategoryForGen(move, generationNum)
        if (!cat) return 'N/A'
        return <span className="move-category-badge" data-category={cat}>{cat}</span>
      }
      case 'power':
        return move.details?.power ?? 'N/A'
      case 'pp':
        return move.details?.pp ?? 'N/A'
      case 'accuracy':
        return move.details?.accuracy ?? 'N/A'
      case 'priority':
        return move.details?.priority ?? 'N/A'
      case 'sourceGames': {
        const src = move.sourceGames
        if (!src) return 'N/A'
        if (typeof src !== 'string') return src
        const parts = src.split(', ')
        if (parts.length <= 3) return src
        return (
          <span title={src} style={{ cursor: 'help' }}>
            {parts.slice(0, 3).join(', ')} <span style={{ fontSize: '10px', color: '#888' }}>+{parts.length - 3} more</span>
          </span>
        )
      }
      case 'learnMethod':
        return methodDisplayNames[move.learnMethod] || formatMoveLabel(move.learnMethod) || 'N/A'
      case 'parents':
        return (
          <button
            type="button"
            className="move-name-link"
            onClick={() => onEggMoveParentsClick(move.name)}
          >
            Parents
          </button>
        )
      case 'introduced':
        return formatMoveLabel(move.details?.generation?.name)
      default:
        return 'N/A'
    }
  }

  // On mobile (<=768px), default to expanded (no max-height scroll)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  return (
    <CollapsibleInfoBox title={title} contentStyle={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }} initialExpanded={isMobile} headerExtra={onNavigateToEggTab && (
      <button
        type="button"
        className="expand-toggle egg-tab-navigate"
        onClick={onNavigateToEggTab}
        title="View on Egg Moves tab"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="13" rx="8" ry="10" />
          <path d="M7 9c0 0 2.5-3 5-3s5 3 5 3" strokeWidth="1.5" />
          <line x1="7" y1="9" x2="17" y2="9" strokeWidth="1.5" />
        </svg>
      </button>
    )}>
      {loading ? (
        <div className="move-loading">
          <video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="move-loading-gif" />
        </div>
      ) : (
      <table className={`move-table${compact ? ' move-table-compact' : ''}`} style={{ margin: '0', ...(compact ? {} : { tableLayout: 'fixed' }) }}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                <button type="button" onClick={() => handleSort(column.key)}>
                  {column.label}{getSortIndicator(column.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedMoves.map(move => {
            const rowKey = showLevel ? `${move.name}-${move.level}` : showTmNumber ? `${move.name}-${move.tmNumber}` : move.name
            if (compact) {
              // Serebii-style: level/tm + name span both rows; effect sits under the remaining columns
              const spanKeys = new Set(['level', 'tmNumber', 'learnMethod', 'name'])
              const spanCols = columns.filter(c => spanKeys.has(c.key))
              const restCols = columns.filter(c => !spanKeys.has(c.key))
              return (
                <React.Fragment key={rowKey}>
                  <tr>
                    {spanCols.map(column => (
                      <td key={column.key} rowSpan={2} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''} move-span-cell`}>
                        {renderCell(move, column.key)}
                      </td>
                    ))}
                    {restCols.map(column => (
                      <td key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                        {renderCell(move, column.key)}
                      </td>
                    ))}
                  </tr>
                  <tr className="move-effect-subrow">
                    <td colSpan={restCols.length} className="move-effect-subrow-cell">
                      {getMoveEffectEntry(move.details)}
                    </td>
                  </tr>
                </React.Fragment>
              )
            }
            return (
              <tr key={rowKey}>
                {columns.map(column => (
                  <td key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                    {renderCell(move, column.key)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      )}
    </CollapsibleInfoBox>
  )
}
