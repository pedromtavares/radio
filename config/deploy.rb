set :use_sudo,            false
set :git_shallow_clone,   1
set :keep_releases,       5
set :application,         "radio"
set :user,                "deployer"
set :deploy_to,           "/home/deployer/radio"
set :runner,              "deployer"
set :repository,          "git@github.com:pedromtavares/radio.git"
set :scm,                 :git
set :node_file,           "server.js"
ssh_options[:paranoid]    = false
default_run_options[:pty] = true

set :node_env, "production"
set :branch, "master"
set :application_port, "80"

role :app, "173.255.227.12"

namespace :deploy do
  task :start do
    sudo "start #{application}_#{node_env}"
  end

  task :stop do
    sudo "stop #{application}_#{node_env}"
  end

  task :restart do
    sudo "restart #{application}_#{node_env} || start #{application}_#{node_env}"
  end
  
  task :reset_shoutcast do
    run "killall -9 sc_serv && /home/deployer/shoutcast/sc_serv daemon /home/deployer/shoutcast/sc_serv_basic.conf "
  end

  # desc "Symlink config files"
  # task :symlink_configs, :roles => :app do
  #   %w[app_config.yml].each do |f|
  #     run "ln -sf #{shared_path}/config/#{f} #{release_path}/config/#{f}"
  #   end
  # end

  # desc "Check required packages and install if packages are not installed"
  # task :check_packages, roles => :app do
  #   run "cd #{release_path} && jake depends"
  # end

  task :create_deploy_to_with_sudo, :roles => :app do
    run "sudo mkdir -p #{deploy_to}"
    run "sudo chown #{runner} #{deploy_to}"
  end

  task :write_upstart_script, :roles => :app do
    upstart_script = <<-UPSTART
  description "#{application}"

  start on startup
  stop on shutdown

  script
      # We found $HOME is needed. Without it, we ran into problems
      export HOME="/home/#{runner}"
      export NODE_ENV="#{node_env}"

      cd #{current_path}
      exec sudo -u #{runner} sh -c "NODE_ENV=#{node_env} /usr/local/bin/node #{current_path}/#{node_file} #{application_port} >> #{shared_path}/log/#{node_env}.log 2>&1"
  end script
  respawn
UPSTART
  put upstart_script, "/tmp/#{application}_upstart.conf"
    run "sudo mv /tmp/#{application}_upstart.conf /etc/init/#{application}_#{node_env}.conf"
  end

  # desc "Update submodules"
  # task :update_submodules, :roles => :app do
  #   run "cd #{release_path}; git submodule init && git submodule update"
  # end

end

before 'deploy', 'deploy:reset_shoutcast'
before 'deploy:setup', 'deploy:create_deploy_to_with_sudo'
after 'deploy:setup', 'deploy:write_upstart_script'
#after "deploy:finalize_update", "deploy:update_submodules", "deploy:symlink_configs", "deploy:check_packages"