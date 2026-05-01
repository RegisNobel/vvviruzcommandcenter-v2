fetch('https://api.song.link/v1-alpha.1/links?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F0VjIjW4GlUZAMYd2vXMi3b')
  .then(r => r.json())
  .then(data => {
    console.log(data);
  });
