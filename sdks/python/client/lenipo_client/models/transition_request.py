from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.rich_text import RichText
  from ..models.rich_text_input_type_1 import RichTextInputType1
  from ..models.update_issue_request import UpdateIssueRequest





T = TypeVar("T", bound="TransitionRequest")



@_attrs_define
class TransitionRequest:
    """ 
        Attributes:
            transition_id (str):
            resolution (str | Unset):
            fields (UpdateIssueRequest | Unset):
            comment (RichText | RichTextInputType1 | Unset):
     """

    transition_id: str
    resolution: str | Unset = UNSET
    fields: UpdateIssueRequest | Unset = UNSET
    comment: RichText | RichTextInputType1 | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        from ..models.update_issue_request import UpdateIssueRequest # noqa: PLC0415
        transition_id = self.transition_id

        resolution = self.resolution

        fields: dict[str, Any] | Unset = UNSET
        if not isinstance(self.fields, Unset):
            fields = self.fields.to_dict()

        comment: dict[str, Any] | Unset
        if isinstance(self.comment, Unset):
            comment = UNSET
        elif isinstance(self.comment, RichText):
            comment = self.comment.to_dict()
        else:
            comment = self.comment.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "transitionId": transition_id,
        })
        if resolution is not UNSET:
            field_dict["resolution"] = resolution
        if fields is not UNSET:
            field_dict["fields"] = fields
        if comment is not UNSET:
            field_dict["comment"] = comment

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        from ..models.update_issue_request import UpdateIssueRequest # noqa: PLC0415
        d = dict(src_dict)
        transition_id = d.pop("transitionId")

        resolution = d.pop("resolution", UNSET)

        _fields = d.pop("fields", UNSET)
        fields: UpdateIssueRequest | Unset
        if isinstance(_fields,  Unset):
            fields = UNSET
        else:
            fields = UpdateIssueRequest.from_dict(_fields)




        def _parse_comment(data: object) -> RichText | RichTextInputType1 | Unset:
            if isinstance(data, Unset):
                return data
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

        comment = _parse_comment(d.pop("comment", UNSET))


        transition_request = cls(
            transition_id=transition_id,
            resolution=resolution,
            fields=fields,
            comment=comment,
        )


        transition_request.additional_properties = d
        return transition_request

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
