from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.rich_text import RichText
  from ..models.rich_text_input_type_1 import RichTextInputType1
  from ..models.text_anchor_input import TextAnchorInput





T = TypeVar("T", bound="CreatePageCommentRequest")



@_attrs_define
class CreatePageCommentRequest:
    """ 
        Attributes:
            body (RichText | RichTextInputType1):
            parent_id (UUID | Unset):
            anchor (TextAnchorInput | Unset):
     """

    body: RichText | RichTextInputType1
    parent_id: UUID | Unset = UNSET
    anchor: TextAnchorInput | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        from ..models.text_anchor_input import TextAnchorInput # noqa: PLC0415
        body: dict[str, Any]
        if isinstance(self.body, RichText):
            body = self.body.to_dict()
        else:
            body = self.body.to_dict()


        parent_id: str | Unset = UNSET
        if not isinstance(self.parent_id, Unset):
            parent_id = str(self.parent_id)

        anchor: dict[str, Any] | Unset = UNSET
        if not isinstance(self.anchor, Unset):
            anchor = self.anchor.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "body": body,
        })
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if anchor is not UNSET:
            field_dict["anchor"] = anchor

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        from ..models.text_anchor_input import TextAnchorInput # noqa: PLC0415
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


        _parent_id = d.pop("parentId", UNSET)
        parent_id: UUID | Unset
        if isinstance(_parent_id,  Unset):
            parent_id = UNSET
        else:
            parent_id = UUID(_parent_id)




        _anchor = d.pop("anchor", UNSET)
        anchor: TextAnchorInput | Unset
        if isinstance(_anchor,  Unset):
            anchor = UNSET
        else:
            anchor = TextAnchorInput.from_dict(_anchor)




        create_page_comment_request = cls(
            body=body,
            parent_id=parent_id,
            anchor=anchor,
        )


        create_page_comment_request.additional_properties = d
        return create_page_comment_request

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
