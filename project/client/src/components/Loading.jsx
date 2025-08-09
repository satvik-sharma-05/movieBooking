const Loading = () => {
  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
    }}>
        <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
        }}>
            {[...Array(3)].map((_, i) => (
                <div
                    key={i}
                    style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#3498db',
                        animation: `loading-bounce 1s ${i * 0.2}s infinite ease-in-out`
                    }}
                />
            ))}
        </div>
        <span style={{
            color: '#3498db',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            letterSpacing: '2px'
        }}>Loading...</span>
        <style>
            {`
                @keyframes loading-bounce {
                    0%, 80%, 100% { transform: scale(0.7); opacity: 0.7; }
                    40% { transform: scale(1.2); opacity: 1; }
                }
            `}
        </style>
    </div>
  )
}

export default Loading