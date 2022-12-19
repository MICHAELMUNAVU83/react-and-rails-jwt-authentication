class Api::V1::UsersController < ApplicationController
    skip_before_action :authorized, only: [:create]
    def create
        user = User.new(user_params)
        if user.save
            token = encode_token({user_id: user.id})
            render json: {user: UserSerializer.new(user), jwt: token}
        else
            render json: {error: "Error creating user"}
        end
    end
    def profile
        render json: { user: UserSerializer.new(current_user) }, status: :accepted
    end

    private
    def user_params
        params.require(:user).permit(:username, :email, :password)
    end
end
