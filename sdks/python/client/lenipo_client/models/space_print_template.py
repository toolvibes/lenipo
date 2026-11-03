from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.print_template import PrintTemplate





T = TypeVar("T", bound="SpacePrintTemplate")



@_attrs_define
class SpacePrintTemplate:
    """ 
        Attributes:
            template (None | PrintTemplate):
            own (bool):
     """

    template: None | PrintTemplate
    own: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.print_template import PrintTemplate # noqa: PLC0415
        template: dict[str, Any] | None
        if isinstance(self.template, PrintTemplate):
            template = self.template.to_dict()
        else:
            template = self.template

        own = self.own


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "template": template,
            "own": own,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.print_template import PrintTemplate # noqa: PLC0415
        d = dict(src_dict)
        def _parse_template(data: object) -> None | PrintTemplate:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                template_type_0 = PrintTemplate.from_dict(data)



                return template_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PrintTemplate, data)

        template = _parse_template(d.pop("template"))


        own = d.pop("own")

        space_print_template = cls(
            template=template,
            own=own,
        )

        return space_print_template

