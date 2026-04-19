export function formatDistance(distanceM: number) {
  return `${(distanceM / 1000).toFixed(1)} km`
}

export function formatDuration(durationS: number) {
  const totalMinutes = Math.round(durationS / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}
