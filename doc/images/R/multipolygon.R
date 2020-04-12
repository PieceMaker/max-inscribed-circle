library(ggplot2)

largerAreaShape <- data.frame(
  x = c(0, 1, 1, 2, 2, 3, 3, 0, 0),
  y = c(0, 0, 3, 3, 0, 0, 4, 4, 0)
)
smallerAreaShape <- data.frame(
  x = c(-3, -1, -1, -3, -3),
  y = c(-3, -3, -1, -1, -3)
)
mic <- data.frame(
  x = 1.25+cos(seq(0, 2*pi, length.out = 2500))/2,
  y = 3.5+sin(seq(0, 2*pi, length.out = 2500))/2
)
micCenter <- data.frame(x = 1.25, y = 3.5)
ggplot() +
  geom_path(data = largerAreaShape, aes(x, y), colour = 'black') +
  geom_path(data = smallerAreaShape, aes(x, y), colour = 'black') +
  geom_path(data = mic, aes(x, y), colour = 'blue') +
  geom_point(data = micCenter, aes(x, y), colour = 'blue') +
  coord_fixed() +
  theme(
    axis.title = element_blank(),
    axis.ticks = element_blank(),
    axis.text = element_blank(),
    plot.background = element_rect(fill = '#DCDCDC'),
    legend.background = element_rect(fill = '#DCDCDC'),
    plot.margin = margin(0.1, 0.1, 0.1, 0.1, "cm"),
    panel.background = element_rect(fill = "#D3D3D3")
  )

ggsave(filename = '../multipolygon.png', height = 6, width = 6, dpi = 100)