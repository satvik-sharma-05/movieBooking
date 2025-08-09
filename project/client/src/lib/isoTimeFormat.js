const isoTimeFormat = (dateTime) => {
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    return '';
  }
  const localTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return localTime;
}

export default isoTimeFormat;