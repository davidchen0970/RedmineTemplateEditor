# Troubleshooting

## Board Does Not Post

Check these in order.

- Confirm the power cord is seated
- Verify the flash is blank-check clean
- [Full Boot Guide](./boot/blank_flash.md)

Then try the alternate flow:

```bash
flashrom -p internal --ifd -i bios -w image.bin
```

## Logs

- [Console Log](https://example.com/logs/rc)
- [I2C NAK Trace](./debug/i2c_nak.md)
