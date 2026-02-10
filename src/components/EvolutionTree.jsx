export function renderEvolutionNode(node, currentPokemonName, onEvolutionClick) {
  if (!node) return null
  const isCurrent = node.name === currentPokemonName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={() => onEvolutionClick?.(node.name)}
        style={{
          padding: '6px 12px',
          backgroundColor: isCurrent ? '#ff0000' : '#444',
          color: '#fff',
          border: isCurrent ? '2px solid #cc0000' : '1px solid #666',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: isCurrent ? 'bold' : 'normal',
          fontSize: '12px',
          textTransform: 'capitalize',
          boxShadow: isCurrent ? '0 2px 4px rgba(255, 0, 0, 0.3)' : 'none'
        }}
      >
        {node.name}
      </button>

      {node.children?.length === 1 && (
        <>
          <div style={{ color: '#ff6b6b', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', maxWidth: '140px' }}>
            {node.children[0].triggerText}
          </div>
          {renderEvolutionNode(node.children[0].node, currentPokemonName, onEvolutionClick)}
        </>
      )}

      {node.children?.length > 1 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
          {node.children.map((edge, idx) => (
            <div key={`${node.name}->${edge.node.name}-${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ color: '#ff6b6b', fontSize: '11px', fontWeight: 'bold', textAlign: 'center', maxWidth: '120px', lineHeight: '1.3' }}>
                {edge.triggerText}
              </div>
              {renderEvolutionNode(edge.node, currentPokemonName, onEvolutionClick)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
