import { useState } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState<string | null>(null)
  const [animation, setAnimation] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isGreenBackground, setIsGreenBackground] = useState(false)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImage(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const generateAnimation = async () => {
    if (!uploadedFile) return
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', uploadedFile)
      formData.append('backgroundColor', isGreenBackground ? '#00FF00' : 'white')

      const response = await fetch('http://localhost:3001/api/generate-animation', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to generate animation')
      }

      const blob = await response.blob()
      const videoUrl = URL.createObjectURL(blob)
      setAnimation(videoUrl)
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to generate animation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (animation) {
      const a = document.createElement('a')
      a.href = animation
      a.download = 'paper-unfold-animation.mp4'
      a.click()
    }
  }

  return (
    <div className="container">
      <h1>Paper Unfolding Animation</h1>
      
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleImageUpload}
        className="file-input"
        disabled={isLoading}
      />

      <div className="background-toggle">
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isGreenBackground}
            onChange={() => setIsGreenBackground(!isGreenBackground)}
            disabled={isLoading}
          />
          <span className="toggle-slider"></span>
        </label>
        <span className="toggle-label">Green Background</span>
      </div>

      {image && (
        <div className="preview">
          <img src={image} alt="Preview" />
          <button 
            onClick={generateAnimation}
            disabled={isLoading}
          >
            Generate Animation
          </button>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Generating your animation...</p>
        </div>
      )}

      {animation && !isLoading && (
        <div className="result">
          <video src={animation} controls />
          <button onClick={handleDownload}>Download Animation</button>
        </div>
      )}
    </div>
  )
}

export default App 