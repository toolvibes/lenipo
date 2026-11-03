from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.rich_text import RichText
  from ..models.rich_text_input_type_1 import RichTextInputType1





T = TypeVar("T", bound="UpdatePageCommentRequest")



@_attrs_define
class UpdatePageCommentRequest:
    """ 
        Attributes:
            body (RichText | RichTextInputType1):
     """

    body: RichText | RichTextInputType1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        body: dict[str, Any]
        if isinstance(self.body, RichText):
            body = self.body.to_dict()
        else:
            body = self.body.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "body": body,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_body(data: object) -> RichText | RichTextInputType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_input_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_rich_text_input_type_1 = RichTextInputType1.from_dict(data)



            return componentsschemas_rich_text_input_type_1

        body = _parse_body(d.pop("body"))


        update_page_comment_request = cls(
            body=body,
        )


        update_page_comment_request.additional_properties = d
        return update_page_comment_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
