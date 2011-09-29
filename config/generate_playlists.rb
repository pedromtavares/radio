File.open(Dir.pwd + '/public/js/playlists.js', 'w') do |file|
  file.write("var Playlists = {")
  Dir.foreach(File.expand_path('./public/system/music/')) do |genre|
    next if genre == '.' || genre == '..' || genre == '.DS_Store'
    file.write("'#{genre}' : [")
    Dir.foreach(File.expand_path("public/system/music/#{genre}")) do |song|
      next if song == '.' || song == '..' || song== '.DS_Store'
      title = song.gsub('.mp3', '')
      file.write("{title: \"#{title}\", mp3: \"../system/music/#{genre}/#{song}\"},")
    end
    file.write("],\n")
  end
  file.write("};")
end