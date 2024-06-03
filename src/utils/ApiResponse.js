class ApiResponse{
    constructor(statusCode, data, message="Success"){
        this.statusCode = statusCode,
        this.data = data,
        thus.message = message,
        this.success = statusCode < 400
    }
}