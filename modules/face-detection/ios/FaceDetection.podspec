Pod::Spec.new do |s|
  s.name           = 'FaceDetection'
  s.version        = '1.0.0'
  s.summary        = 'Native Apple Vision face detection for Expo'
  s.description    = 'Runs VNDetectFaceLandmarksRequest on static images asynchronously'
  s.author         = 'Shawn Lee'
  s.homepage       = 'https://github.com/slzwei/lyfe-app'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
