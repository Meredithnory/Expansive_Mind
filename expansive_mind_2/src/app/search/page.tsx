'use client'

import { useEffect } from "react"


export default function SearchPage() {
  useEffect( () => {
    fetch('/api/search')
    .then(resp => resp.json())
    .then((data: any) => {
      console.log(data)
    })
  }, [])
  return (
    <div>
      Search Page
    </div>
  )
}