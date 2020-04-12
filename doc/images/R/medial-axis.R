library(ggplot2)

shape <- data.frame(
  x = c(0, 1, 1, 2, 2, 3, 3, 0, 0),
  y = c(0, 0, 3, 3, 0, 0, 4, 4, 0)
)
medialAxisCentral <- data.frame(
  x = c(
    0.5, 0.5,
    1+cos(seq(-pi, -3/2*pi, length.out = 625))/2,
    1, 2,
    2+cos(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    2.5, 2.5
  ),
  y = c(
    0.5, 3,
    3+sin(seq(-pi, -3/2*pi, length.out = 625))/2,
    3.5, 3.5,
    3+sin(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    3, 0.5
  )
)
medialAxisWings1 <- data.frame(
  x = c(0, 0.5, 1),
  y = c(0, 0.5, 0)
)
medialAxisWings2 <- data.frame(
  x = c(2, 2.5, 3),
  y = c(0, 0.5, 0)
)
medialAxisWings3 <- data.frame(
  x = c(0, 1-(2^0.5/2)/2),
  y = c(4, 3+(2^0.5/2)/2)
)
medialAxisWings4 <- data.frame(
  x = c(2+(2^0.5/2)/2, 3),
  y = c(3+(2^0.5/2)/2, 4)
)
ggplot() +
  geom_path(data = shape, aes(x, y, linetype = 'Shape')) +
  geom_path(
    data = medialAxisCentral,
    aes(x, y, linetype = 'Medial\nAxis')
  ) +
  geom_path(
    data = medialAxisWings1,
    aes(x, y, linetype = 'Medial\nAxis')
  ) +
  geom_path(
    data = medialAxisWings2,
    aes(x, y, linetype = 'Medial\nAxis')
  ) +
  geom_path(
    data = medialAxisWings3,
    aes(x, y, linetype = 'Medial\nAxis')
  ) +
  geom_path(
    data = medialAxisWings4,
    aes(x, y, linetype = 'Medial\nAxis')
  ) +
  coord_fixed() +
  scale_linetype_manual(values = c("Shape" = "solid", "Medial\nAxis" = "dashed")) +
  guides(
    linetype = guide_legend(title = '')
  ) +
  theme(
    axis.title = element_blank(),
    axis.ticks = element_blank(),
    axis.text = element_blank(),
    plot.background = element_rect(fill = '#DCDCDC'),
    legend.background = element_rect(fill = '#DCDCDC'),
    plot.margin = margin(0.1, 0.1, 0.1, 0.1, "cm"),
    panel.background = element_rect(fill = "#D3D3D3")
  )

ggsave(filename = '../medial-axis.png', height = 6, width = 6, dpi = 100)