function treeContainsName(nodes, name) {
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.pop()
    if (!n) continue
    if (n.name === name) return true
    for (const edge of (n.children || [])) { if (edge) stack.push(edge.node) }
  }
  return false
}

export function renderEvolutionForest(nodes, currentPokemonName, onEvolutionClick, currentSpeciesName) {
  if (!nodes?.length) return null
  // Chain nodes carry species names, but the current Pokémon may be a form
  // (aegislash-shield, raichu-alola). Prefer an exact form-name match (regional
  // evo nodes use form names, e.g. raichu-alola); fall back to the species name
  // only when no node matches the form — otherwise Alolan Raichu would light up
  // both the raichu-alola node and the Kantonian raichu node.
  const matchName = (currentSpeciesName && !treeContainsName(nodes, currentPokemonName))
    ? currentSpeciesName
    : currentPokemonName

  if (nodes.length === 1) {
    return renderEvolutionNode(nodes[0], matchName, onEvolutionClick)
  }

  return (
    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {nodes.map((node) => (
        <div key={node.name} style={{ display: 'flex', justifyContent: 'center' }}>
          {renderEvolutionNode(node, matchName, onEvolutionClick)}
        </div>
      ))}
    </div>
  )
}

export function renderEvolutionNode(node, currentPokemonName, onEvolutionClick) {
  if (!node) return null
  const isCurrent = node.name === currentPokemonName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
      <button
        onClick={() => onEvolutionClick?.(node.name)}
        style={{
          padding: '5px 10px',
          backgroundColor: isCurrent ? '#ff0000' : '#444',
          color: '#fff',
          border: isCurrent ? '2px solid #cc0000' : '1px solid #666',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: isCurrent ? 'bold' : 'normal',
          fontSize: '11px',
          textTransform: 'capitalize',
          boxShadow: isCurrent ? '0 2px 4px rgba(255, 0, 0, 0.3)' : 'none'
        }}
      >
        {node.name}
      </button>

      {node.children?.length === 1 && (
        <>
          <div
            title={node.children[0].triggerText}
            style={{
              color: '#ff6b6b',
              fontSize: '10px',
              fontWeight: 'bold',
              textAlign: 'center',
              maxWidth: '120px',
              lineHeight: '1.15',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden'
            }}
          >
            {node.children[0].triggerText}
          </div>
          {renderEvolutionNode(node.children[0].node, currentPokemonName, onEvolutionClick)}
        </>
      )}

      {node.children?.length > 1 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '10px',
            width: '100%',
            alignItems: 'start',
            justifyItems: 'center',
            marginTop: '6px'
          }}
        >
          {node.children.map((edge, idx) => (
            <div
              key={`${node.name}->${edge.node.name}-${idx}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                width: 'auto'
              }}
            >
              {node.children.length < 6 ? (
                <div
                  title={edge.triggerText}
                  style={{
                    color: '#ff6b6b',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    maxWidth: '120px',
                    lineHeight: '1.15',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden'
                  }}
                >
                  {edge.triggerText}
                </div>
              ) : (
                <div
                  title={edge.triggerText}
                  style={{
                    fontSize: '10px',
                    color: '#ff6b6b',
                    fontWeight: 'bold',
                    cursor: 'help'
                  }}
                >
                  ⓘ
                </div>
              )}
              {renderEvolutionNode(edge.node, currentPokemonName, onEvolutionClick)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
