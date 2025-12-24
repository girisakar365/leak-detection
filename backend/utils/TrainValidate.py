import torch

# Training function
def train_model(model, dataloader, optimizer, criterion, device):
    model.train()  # Set the model to training mode
    total_loss = 0.0

    for inputs, targets in dataloader:
        inputs, targets = inputs.to(device), targets.to(device)  # Move data to device
        optimizer.zero_grad()  # Zero gradients from the previous step

        outputs = model(inputs)  # Forward pass
        loss = criterion(outputs, targets)  # Calculate loss
        loss.backward()  # Backpropagation
        optimizer.step()  # Update weights

        total_loss += loss.item()

    return total_loss / len(dataloader)


# Validation function
def validate_model(model, dataloader, criterion, device,output_means, output_stds):
    model.eval()  # Set model to evaluation mode
    total_loss = 0.0
    num_samples = 0
    normalized_output_losses = {key: 0.0 for key in output_means.keys()}
    denormalized_output_losses = {key: 0.0 for key in output_means.keys()}

    with torch.no_grad():  # Disable gradient calculations
        for inputs, targets in dataloader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            # Get model predictions
            outputs = model(inputs)

            # Calculate the total loss (summed across all outputs)
            batch_loss = criterion(outputs, targets)
            total_loss += batch_loss.item() * inputs.size(0)  # Accumulate weighted loss by batch size

            # Calculate per-output normalized and denormalized loss
            for i, key in enumerate(output_means.keys()):
                # Compute loss for each output individually (normalized space)
                output_loss = criterion(outputs[:, i], targets[:, i]).item()
                normalized_output_losses[key] += output_loss * inputs.size(0)

                # Denormalize the loss to original scale
                denormalized_output_losses[key] += output_loss * (output_stds[key] ** 2) * inputs.size(0)

            num_samples += inputs.size(0)

    # Normalize losses by number of samples
    total_loss /= num_samples
    for key in normalized_output_losses.keys():
        normalized_output_losses[key] /= num_samples
        denormalized_output_losses[key] /= num_samples  # Average over samples for real-world units

    return total_loss, normalized_output_losses, denormalized_output_losses